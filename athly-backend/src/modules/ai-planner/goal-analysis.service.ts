import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CodedNotFoundException } from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { predictRaceTime } from '../effort-zones/vdot-calculator';
import {
  buildParsedGoal,
  mapExperienceLevel,
  resolveEventDate,
  validateTargetTime,
} from '../goals/goal-builder';
import { HeartRateHealthService } from '../users/heart-rate-health.service';
import type { GoalAnalysisDto } from './dto/goal-analysis.dto';
import { MAX_HEALTH_RUNS, type PlanFromHealthDto } from './dto/plan-from-health.dto';
import { zoneCandidates } from './effort-candidates';
import {
  analysisText,
  projectionAlternative,
  raceAlternatives,
  type AnalysisAlternative,
} from './goal-analysis';
import {
  assessGoalFeasibility,
  parseTargetDistanceMeters,
  parseTargetTimeSeconds,
  type FeasibilityVerdict,
} from './goal-feasibility';
import {
  assessDatedGoal,
  combineFeasibility,
  healthObjectiveEvidence,
  summarizeAssessment,
} from './objective-goal';
import type { ParsedGoal } from './prompts/goal-parser-prompt';

// Mesmo recorte da geração: as zonas (e o VDOT) saem das 20 corridas mais recentes.
const ZONE_RUNS = 20;

export interface GoalAnalysisResult {
  goal: Pick<ParsedGoal, 'summary' | 'targetDistance' | 'targetTime' | 'eventDate'>;
  /** Falso para meta sem prova datada ou sem distância (fitness, ultra): o app pula a tela. */
  applicable: boolean;
  verdict: FeasibilityVerdict | null;
  lowConfidence: boolean;
  hasHistory: boolean;
  title: string;
  message: string;
  numbers: {
    currentVdot: number | null;
    requiredVdot: number | null;
    targetTimeSec: number | null;
    timeTodaySec: number | null;
    timeAtEventSec: number | null;
    weeksAvailable: number | null;
    daysAvailable: number | null;
    enduranceDemonstrated: boolean | null;
    longestKm: number | null;
    requiredLongestKm: number | null;
    weeklyKm: number | null;
    requiredWeeklyKm: number | null;
  };
  alternatives: AnalysisAlternative[];
}

/**
 * Análise da meta antes de gerar o plano: o mesmo veredito que a geração grava (VDOT + motor
 * objetivo), até 3 alternativas na mesma data e um texto para a tela. Não chama a IA nem grava
 * zonas; só atualiza a viabilidade da meta ativa (com tempo alvo), como a geração faria.
 */
@Injectable()
export class GoalAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly effortZones: EffortZoneService,
    private readonly heartRateHealth: HeartRateHealthService,
  ) {}

  async analyze(
    userId: string,
    body: GoalAnalysisDto,
    now = new Date(),
  ): Promise<GoalAnalysisResult> {
    const [activeGoal, user, context] = await Promise.all([
      body.goal
        ? null
        : this.prisma.userGoal.findFirst({
            where: { userId, active: true },
            orderBy: { createdAt: 'desc' },
          }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { fitnessLevel: true } }),
      this.prisma.plannerHealthContext.findUnique({
        where: { userId },
        select: { timeZone: true, capturedAt: true, payload: true },
      }),
    ]);

    let goal: ParsedGoal;
    if (body.goal) {
      const answers = { objective: 'personal', ...body.goal };
      validateTargetTime(answers);
      goal = buildParsedGoal(
        answers,
        resolveEventDate(answers),
        mapExperienceLevel(user?.fitnessLevel),
      );
    } else if (activeGoal) {
      goal = activeGoal.parsedGoal as unknown as ParsedGoal;
    } else {
      throw new CodedNotFoundException(
        ErrorCode.GOAL_NOT_FOUND,
        'Nenhuma meta ativa para analisar.',
      );
    }

    // Mesmo merge da geração: corridas do corpo, do contexto salvo e das execuções do Athly.
    const runs = (await this.heartRateHealth.resolve(userId, body)).runs.slice(0, MAX_HEALTH_RUNS);
    const hasHistory = runs.length > 0;
    const vdot =
      this.effortZones.calculateFromRuns(
        zoneCandidates(runs.slice(0, ZONE_RUNS), body.detailedSessions ?? []),
        'apple_health',
      ).vdotScore ?? null;

    const v1 =
      vdot === null
        ? null
        : assessGoalFeasibility({
            goal: {
              targetDistance: goal.targetDistance,
              targetTime: goal.targetTime,
              eventDate: goal.eventDate,
              experienceLevel: goal.experienceLevel ?? null,
            },
            currentVdot: vdot,
            asOfISO: mondayISO(now),
            lowConfidence: !hasHistory,
          });

    const saved = context?.payload as unknown as PlanFromHealthDto | undefined;
    const readFrom = body.runsReadFrom ?? saved?.runsReadFrom;
    const timeZone = [body.timeZone, context?.timeZone].find(validTimeZone) ?? 'UTC';
    const distanceMeters = parseTargetDistanceMeters(goal.targetDistance);
    const timeSeconds = parseTargetTimeSeconds(goal.targetTime);
    const evidence = goal.eventDate
      ? healthObjectiveEvidence({
          userId,
          runs,
          asOf: now,
          timeZone,
          readLimit: ZONE_RUNS,
          readFrom: readFrom ? new Date(readFrom) : null,
          // Corridas vindas no corpo foram lidas agora; as do contexto salvo, quando ele foi salvo.
          capturedAt: body.runs?.length ? now : (context?.capturedAt ?? now),
        })
      : null;
    const assessment = evidence
      ? assessDatedGoal({ distanceMeters, timeSeconds, eventDate: goal.eventDate, evidence })
      : null;
    const readiness = assessment ? summarizeAssessment(assessment) : null;
    const feasibility = v1 ? combineFeasibility(v1, assessment) : null;

    let alternatives: AnalysisAlternative[] = [];
    if (evidence && assessment && goal.eventDate) {
      alternatives = raceAlternatives(
        { modality: 'running', distanceMeters, timeSeconds, eventDate: goal.eventDate, timeZone },
        evidence,
        assessment,
      );
    }
    // Sem corridas, a projeção sairia de um VDOT padrão, não do atleta: nada a sugerir.
    if (!alternatives.length && hasHistory) {
      const fallback = projectionAlternative(feasibility, goal);
      if (fallback) alternatives = [fallback];
    }

    // A geração grava a mesma viabilidade; gravar aqui deixa o cartão do app certo desde já.
    // Só metas com tempo alvo: os apps publicados exigem os campos de tempo.
    if (activeGoal && feasibility) {
      // Só se a meta ainda está ativa: uma troca simultânea vence.
      await this.prisma.userGoal.updateMany({
        where: { id: activeGoal.id, active: true },
        data: { feasibility: { ...feasibility, alternatives } as unknown as Prisma.InputJsonValue },
      });
    }

    const { title, message } = analysisText({ goal, hasHistory, feasibility, readiness });
    const endurance = readiness?.endurance;
    return {
      goal: {
        summary: goal.summary,
        targetDistance: goal.targetDistance,
        targetTime: goal.targetTime,
        eventDate: goal.eventDate,
      },
      applicable: Boolean(goal.eventDate && distanceMeters),
      verdict: feasibility?.verdict ?? null,
      lowConfidence: feasibility?.lowConfidence ?? !hasHistory,
      hasHistory,
      title,
      message,
      numbers: {
        currentVdot: feasibility?.currentVdot ?? vdot,
        requiredVdot: feasibility?.requiredVdot ?? readiness?.performance.requiredVdot ?? null,
        targetTimeSec: timeSeconds,
        timeTodaySec: feasibility?.currentProjectedTimeSec ?? null,
        timeAtEventSec:
          feasibility && distanceMeters
            ? Math.round(predictRaceTime(feasibility.projectedVdot, distanceMeters))
            : null,
        weeksAvailable: feasibility?.weeksAvailable ?? null,
        daysAvailable: readiness?.daysAvailable ?? null,
        enduranceDemonstrated:
          !endurance || endurance.state === 'not_applicable'
            ? null
            : endurance.state === 'supported',
        longestKm: endurance?.longestKm ?? null,
        requiredLongestKm: endurance?.requiredLongestKm ?? null,
        weeklyKm: endurance?.weeklyKm ?? null,
        requiredWeeklyKm: endurance?.requiredWeeklyKm ?? null,
      },
      alternatives,
    };
  }
}

/** Segunda-feira da semana de `date` (YYYY-MM-DD), como a janela de planejamento da geração. */
function mondayISO(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function validTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
