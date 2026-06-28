import { Injectable, ConflictException, Logger } from '@nestjs/common';
import {
  Prisma,
  SportType,
  TrainingPlanStatus,
  WeeklyGoalStatus,
  WorkoutStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { GeminiService, type PlannerExecution } from './gemini.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { AssessmentService } from '../assessment/assessment.service';
import { WorkoutExecutionAnalyzerService } from './workout-execution-analyzer.service';
import { PlanFromHealthDto, DetailedSessionDto, SegmentLabel } from './dto/plan-from-health.dto';
import type {
  AiPlannerInput,
  PreviousWeekAnalysis,
  RunSummary,
} from './types/planner.types';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './prompts/goal-parser-prompt';
import type { UserProfileContext, LongitudinalWeek } from './prompts/planner-prompt';
import { buildMacrocycle, type PlannedWeek } from './periodization';
import { assessGoalFeasibility, parseTargetDistanceMeters } from './goal-feasibility';
import {
  computeLongitudinalWeeks,
  computePreviousWeekAnalysis,
} from './weekly-metrics.util';
import { TrainingReportService } from '../training-report/training-report.service';
import { flattenToLegacyBlocks } from '../workouts/utils/flatten-to-legacy';
import { SEGMENT_SCHEMA_VERSION } from '../workouts/types/segment.types';

const PROMPT_VERSION = 'v3.0';
const MODEL_USED = 'gemini-2.5-flash';
const DETAILED_FIRST_GEN = 5;
const DETAILED_MID_PLAN = 7;
const HISTORICAL_FIRST_GEN = 20;
const LONGITUDINAL_WEEKS = 4;

// Piso de distância para um esforço entrar como candidato a "melhor esforço" do VDOT.
// Esforços curtos demais rodam em regime supramáximo e distorcem a estimativa.
const MIN_EFFORT_METERS = 1500;
// Tiros são corridos QUEBRADOS por recuperação; um esforço contínuo no mesmo pace não é
// sustentável. Penaliza ~5% a duração-equivalente do bloco de tiros para não superestimar
// o VDOT ao tratá-lo como se fosse uma corrida contínua. Knob de calibração — validar
// contra tabelas de Daniels antes de mexer.
const REP_EFFORT_PENALTY = 1.05;

const DEFAULT_AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'];

@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger(AiPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly effortZoneService: EffortZoneService,
    private readonly assessmentService: AssessmentService,
    private readonly executionAnalyzer: WorkoutExecutionAnalyzerService,
    private readonly trainingReportService: TrainingReportService,
  ) {}

  async planFromHealth(userId: string, input: PlanFromHealthDto) {
    const startMonday = input.weekStartDate ? new Date(input.weekStartDate) : this.getNextMonday();
    const weekDates = this.getWeekDates(startMonday);
    const weekStartDate = new Date(weekDates[0]);
    const weekEndDate = new Date(weekDates[6]);

    // Fetch active goal and assessment for context (before creating training plan)
    const [activeGoalRecord, assessmentRecord, userHealth] = await Promise.all([
      this.prisma.userGoal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: 'desc' } }),
      this.assessmentService.findByUser(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { availableDays: true } }),
    ]);
    const activeGoal = activeGoalRecord ? (activeGoalRecord.parsedGoal as unknown as ParsedGoal) : null;
    const userProfile = assessmentRecord ? this.buildUserProfile(assessmentRecord.answers) : null;

    const trainingPlan = await this.resolveTrainingPlan(
      userId,
      weekDates[0],
      activeGoalRecord?.id,
      activeGoal?.summary,
      activeGoal?.eventDate,
    );

    // Read the current week's PLANNED skeleton row (phase/targets) BEFORE
    // checkWeekOverlap deletes it, so dated-goal context survives the overwrite.
    const plannedCurrentRow = await this.prisma.weeklyGoal.findFirst({
      where: {
        trainingPlanId: trainingPlan.id,
        status: WeeklyGoalStatus.PLANNED,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate },
      },
      select: { metrics: true },
    });

    await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);

    const availableDays = userHealth?.availableDays?.length ? userHealth.availableDays : DEFAULT_AVAILABLE_DAYS;
    const trainingDays = availableDays.length;

    // Calculate effort zones from health runs. O pace médio de corrida inteira inclui
    // aquecimento/volta à calma e subestima o VDOT — por isso também entram como
    // candidatos os melhores sub-esforços contínuos (janelas de splits reais) das
    // sessões detalhadas.
    const runsForZones: RunDataForZones[] = [
      ...input.runs.map((r) => ({
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        averageHeartRate: null,
        maxHeartRate: null,
      })),
      ...this.bestSubEffortsFromSessions(input.detailedSessions ?? []),
    ];
    const effortZones = await this.effortZoneService.getOrCalculateForUser(userId, runsForZones, 'apple_health');

    // Build previous week analysis
    const previousWeekAnalysis = await this.buildPreviousWeekAnalysis(trainingPlan.id, weekStartDate);
    const isFirstGeneration = previousWeekAnalysis === null;

    // Slice historical runs per generation-context budget.
    const historicalRuns = isFirstGeneration
      ? input.runs.slice(0, HISTORICAL_FIRST_GEN)
      : input.runs.slice(0, Math.min(input.runs.length, 3));

    // Detailed sessions (executed intervals/tempos with segments + HR) get mastigated server-side.
    const detailedInput = (input.detailedSessions ?? []).slice(
      0,
      isFirstGeneration ? DETAILED_FIRST_GEN : DETAILED_MID_PLAN,
    );
    const analyzedSessions = await this.executionAnalyzer.analyzeSessions(userId, detailedInput);

    // Longitudinal trend only makes sense mid-plan (requires prior WeeklyGoal metrics).
    const longitudinalWeeks = isFirstGeneration
      ? undefined
      : await this.buildLongitudinalTrend(trainingPlan.id, weekStartDate);

    // Cold start: sem corridas no Apple Health → plano de avaliação (mesmo prompt do
    // antigo fluxo sem histórico, agora sob o único endpoint plan-from-health).
    const isAssessment = input.runs.length === 0;
    const aiInput = this.buildAiInputFromHealthRuns(historicalRuns, weekDates, trainingDays, availableDays);

    // Dated-goal periodization: derive the current week's phase/targets and lay out
    // (or extend) the future PLANNED skeleton up to the event. Also refresh the goal's
    // feasibility snapshot with the freshest VDOT.
    const currentWeeklyVolumeKm = aiInput.avgDistKm > 0 ? aiInput.avgDistKm * trainingDays : trainingDays * 4;
    const plannedWeek = await this.resolveCurrentPlannedWeek({
      trainingPlanId: trainingPlan.id,
      startDateISO: trainingPlan.startDate,
      weekStartISO: weekDates[0],
      weekEndDate,
      goal: activeGoal,
      currentWeeklyVolumeKm,
      preReadMetrics: plannedCurrentRow?.metrics ?? null,
    });
    await this.refreshGoalFeasibility(activeGoalRecord?.id, activeGoal, effortZones.vdotScore, weekDates[0]);

    // Continuidade entre planos: um plano novo não tem semanas próprias (cold start).
    // Se houver um laudo do plano anterior, usamos seu contexto APENAS no prompt —
    // sem alterar isFirstGeneration (o slicing de runs/sessões segue o do cold start).
    let promptPreviousWeek = previousWeekAnalysis;
    let promptLongitudinal = longitudinalWeeks;
    let laudoContextNote: string | undefined;
    let laudoConsumed = false;
    if (!isAssessment && !previousWeekAnalysis && (!longitudinalWeeks || longitudinalWeeks.length === 0)) {
      const report = await this.trainingReportService.getForUser(userId);
      if (report) {
        promptLongitudinal = report.longitudinalWeeks?.length ? report.longitudinalWeeks : undefined;
        promptPreviousWeek = report.previousWeekAnalysis ?? null;
        laudoContextNote = report.objective
          ? `Contexto do plano ANTERIOR (laudo, recém-encerrado): o atleta vinha treinando para "${report.objective}". As semanas e a "semana anterior" abaixo são desse período — use como linha de base de aderência/volume/tendência ao planejar o novo ciclo.`
          : undefined;
        laudoConsumed = true;
      }
    }

    const plannerResult = isAssessment
      ? await this.geminiService.generateAssessmentPlan(
          weekDates,
          trainingDays,
          availableDays,
          effortZones,
          activeGoal,
          userProfile,
          analyzedSessions,
        )
      : await this.geminiService.generatePlan(
          aiInput,
          effortZones,
          promptPreviousWeek,
          activeGoal,
          userProfile,
          analyzedSessions,
          promptLongitudinal,
          plannedWeek,
          laudoContextNote,
        );

    const { weeklyGoal, workouts } = await this.prisma.$transaction(async (tx) => {
      const weeklyGoal = await tx.weeklyGoal.create({
        data: {
          trainingPlanId: trainingPlan.id,
          weekStartDate,
          weekEndDate,
          status: WeeklyGoalStatus.GENERATED,
          metrics: plannerResult.parsed.analysis as unknown as Prisma.InputJsonValue,
          previousWeekAnalysis: previousWeekAnalysis
            ? (previousWeekAnalysis as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const workouts = await Promise.all(
        plannerResult.parsed.weekPlan.map((day) =>
          tx.workout.create({
            data: {
              trainingPlanId: trainingPlan.id,
              weeklyGoalId: weeklyGoal.id,
              userId,
              dateScheduled: new Date(day.date),
              sportType: day.sportType,
              title: day.title,
              description: day.description,
              blocks: this.deriveBlocksForPersistence(day) as unknown as Prisma.InputJsonValue,
              segments: {
                schemaVersion: SEGMENT_SCHEMA_VERSION,
                sport: day.sportType,
                segments: day.segments ?? [],
              } as unknown as Prisma.InputJsonValue,
              status: WorkoutStatus.scheduled,
              intensity: day.intensity,
              isGoalAttempt: day.isGoalAttempt ?? false,
            },
          }),
        ),
      );

      // Persist AI reasoning
      await Promise.all(
        plannerResult.parsed.weekPlan.map(async (day, idx) => {
          if (day.reasoning && day.sportType !== 'other') {
            await tx.aiReasoning.create({
              data: {
                workoutId: workouts[idx].id,
                weeklyGoalId: weeklyGoal.id,
                justification: day.reasoning,
                dataPointsUsed: {
                  avgPace: plannerResult.parsed.analysis.avgPace,
                  totalDistanceKm: plannerResult.parsed.analysis.totalDistanceKm,
                  vdotScore: effortZones.vdotScore,
                  trend: plannerResult.parsed.analysis.trend,
                } as unknown as Prisma.InputJsonValue,
                promptVersion: PROMPT_VERSION,
                modelUsed: MODEL_USED,
              },
            });
          } else if (day.sportType !== 'other' && !day.reasoning) {
            this.logger.warn(`Workout "${day.title}" on ${day.date} missing AI reasoning`);
          }
        }),
      );

      await tx.aiPlannerPromptLog.create({
        data: {
          weeklyGoalId: weeklyGoal.id,
          generationType: isAssessment ? 'assessment' : 'planner',
          promptVersion: PROMPT_VERSION,
          modelUsed: MODEL_USED,
          promptText: plannerResult.prompt,
          rawResponse: plannerResult.rawResponse,
          parsedResponse: plannerResult.parsed as unknown as Prisma.InputJsonValue,
        },
      });

      return { weeklyGoal, workouts };
    });

    // Laudo consumido com sucesso (consume-once) — limpa para não brifar planos futuros com dados velhos.
    if (laudoConsumed) {
      await this.trainingReportService
        .clearForUser(userId)
        .catch((e) => this.logger.warn(`Failed to clear training report for user ${userId}: ${e}`));
    }

    return {
      trainingPlan: { id: trainingPlan.id, status: trainingPlan.status as any },
      weeklyGoal: {
        id: weeklyGoal.id,
        trainingPlanId: weeklyGoal.trainingPlanId,
        weekStartDate: weeklyGoal.weekStartDate,
        weekEndDate: weeklyGoal.weekEndDate,
        status: weeklyGoal.status as any,
        metrics: weeklyGoal.metrics as any,
        previousWeekAnalysis: weeklyGoal.previousWeekAnalysis as any,
        createdAt: weeklyGoal.createdAt,
        updatedAt: weeklyGoal.updatedAt,
      },
      workouts: workouts.map((w) => ({
        id: w.id,
        date: w.dateScheduled.toISOString().split('T')[0],
        sportType: w.sportType as any,
        title: w.title,
        description: w.description ?? undefined,
        blocks: w.blocks as any,
        status: w.status as any,
        intensity: w.intensity ?? undefined,
        stravaActivityId: w.stravaActivityId ?? null,
      })),
      analysis: plannerResult.parsed.analysis,
      isAssessment,
    };
  }

  private buildUserProfile(answers: any): UserProfileContext {
    const parqFlagMap: Record<string, string> = {
      heartCondition: 'Condição cardíaca diagnosticada por médico',
      chestPainDuringActivity: 'Dor no peito durante atividade física',
      chestPainLastMonth: 'Dor no peito no último mês',
      dizzinessOrLossOfConsciousness: 'Tonturas ou perda de consciência',
      boneJointProblem: 'Problema ósseo ou articular que piora com exercício',
      takingBloodPressureMeds: 'Medicação para pressão arterial',
      otherReasonToAvoidExercise: 'Outro motivo para evitar exercício físico',
    };

    const parqFlags: string[] = [];
    if (answers?.parq) {
      for (const [key, label] of Object.entries(parqFlagMap)) {
        if (answers.parq[key] === true) parqFlags.push(label);
      }
    }

    return {
      sleepQuality: answers?.performanceHealth?.sleepQuality,
      hasChronicPain: answers?.performanceHealth?.hasChronicPain === 'yes',
      chronicPainDescription: answers?.performanceHealth?.chronicPainDescription,
      canRun3km: answers?.activityHistory?.canRun3km,
      runningExperience: answers?.activityHistory?.runningExperience,
      motivations: answers?.goals?.motivations,
      parqFlags,
    };
  }

  private async buildPreviousWeekAnalysis(
    trainingPlanId: string,
    currentWeekStart: Date,
  ): Promise<PreviousWeekAnalysis | null> {
    // As duas semanas mais recentes antes da atual: a anterior (analisada) e a
    // retrasada (baseline do volumeChange). Comparar executado × executado — o
    // metrics.totalDistanceKm da própria goal é a soma das corridas de ENTRADA da
    // geração e fabricava "reduziu 75%".
    const recentGoals = await this.prisma.weeklyGoal.findMany({
      where: {
        trainingPlanId,
        weekEndDate: { lt: currentWeekStart },
      },
      orderBy: { weekStartDate: 'desc' },
      take: 2,
      include: {
        workouts: {
          include: {
            feedback: true,
          },
        },
      },
    });

    // recentGoals[0] = semana anterior (analisada); [1] = baseline do volumeChange.
    return computePreviousWeekAnalysis(recentGoals);
  }

  /**
   * Candidatos de esforço LIMPO para o cálculo de VDOT a partir de sessões detalhadas.
   * O pace médio de corrida inteira subestima o atleta — e uma janela contínua que inclua
   * as recuperações entre tiros também (era o bug: tiros sub-5'00 saíam diluídos pelos
   * trotes e o VDOT vinha baixo). Em vez disso, por sessão extraímos:
   *   (1) candidato de qualidade: os tiros (`rep`) concatenados, SEM as recuperações;
   *   (2) candidato sustentado: a melhor janela contínua (>= MIN_EFFORT_METERS) de blocos
   *       de esforço estável (`tempo`/`easy`), excluindo tiros e recuperações.
   * findBestEffort escolhe depois o de VDOT mais alto entre todos os candidatos. Sessões
   * `synthetic` (Garmin/Nike só com totais via Apple Health) não têm splits reais e são
   * ignoradas — caem no piso dos totais de input.runs.
   */
  private bestSubEffortsFromSessions(sessions: DetailedSessionDto[]): RunDataForZones[] {
    const candidates: RunDataForZones[] = [];
    for (const session of sessions) {
      if (session.splitsSource === 'synthetic') continue;
      const segs = session.segments ?? [];

      // (1) Qualidade: soma só dos tiros (rep), recuperações fora. Captura a velocidade
      // real dos tiros sem a diluição dos trotes.
      const reps = segs.filter(
        (s) => s.label === SegmentLabel.rep && s.distanceKm > 0 && s.durationSeconds > 0,
      );
      const repDistM = reps.reduce((sum, s) => sum + s.distanceKm * 1000, 0);
      const repDurSec = reps.reduce((sum, s) => sum + s.durationSeconds, 0);
      if (repDistM >= MIN_EFFORT_METERS && repDurSec > 0) {
        candidates.push({
          distanceMeters: repDistM,
          durationSeconds: repDurSec * REP_EFFORT_PENALTY,
          averageHeartRate: null,
          maxHeartRate: null,
        });
      }

      // (2) Sustentado: melhor janela contínua de tempo/easy (sem rep/rec). Cobre tempo
      // runs e o trecho mais rápido de corridas steady/progressivas.
      const steady = segs.filter(
        (s) =>
          (s.label === SegmentLabel.tempo || s.label === SegmentLabel.easy) &&
          s.distanceKm > 0 &&
          s.durationSeconds > 0,
      );
      const best = this.bestContinuousWindow(steady);
      if (best) {
        candidates.push({
          distanceMeters: best.distM,
          durationSeconds: best.durSec,
          averageHeartRate: null,
          maxHeartRate: null,
        });
      }
    }
    return candidates;
  }

  /**
   * Melhor (mais rápida) janela contígua de >= MIN_EFFORT_METERS a partir de uma lista de
   * splits de esforço estável já filtrada. Janela mínima a partir de cada início: janelas
   * maiores só diluiriam o pace.
   */
  private bestContinuousWindow(
    segs: Array<{ distanceKm: number; durationSeconds: number }>,
  ): { distM: number; durSec: number } | null {
    let best: { distM: number; durSec: number } | null = null;
    for (let i = 0; i < segs.length; i++) {
      let distM = 0;
      let durSec = 0;
      for (let j = i; j < segs.length; j++) {
        distM += segs[j].distanceKm * 1000;
        durSec += segs[j].durationSeconds;
        if (distM >= MIN_EFFORT_METERS) {
          const pace = durSec / (distM / 1000);
          const bestPace = best ? best.durSec / (best.distM / 1000) : Infinity;
          if (pace < bestPace) best = { distM, durSec };
          break;
        }
      }
    }
    return best;
  }

  private async buildLongitudinalTrend(
    trainingPlanId: string,
    currentWeekStart: Date,
  ): Promise<LongitudinalWeek[] | undefined> {
    const recent = await this.prisma.weeklyGoal.findMany({
      where: {
        trainingPlanId,
        weekEndDate: { lt: currentWeekStart },
      },
      orderBy: { weekStartDate: 'desc' },
      take: LONGITUDINAL_WEEKS,
      include: {
        workouts: { include: { feedback: true } },
      },
    });

    if (recent.length === 0) return undefined;
    return computeLongitudinalWeeks(recent);
  }

  private buildAiInputFromHealthRuns(
    runs: PlanFromHealthDto['runs'],
    weekDates: string[],
    trainingDays: number,
    availableDays: string[],
  ): AiPlannerInput {
    // Descarta outliers (<0.5km OU <3min) das stats agregadas — fallback para runs original se zerar.
    const validRunsRaw = runs.filter((r) => r.distanceMeters >= 500 && r.durationSeconds >= 180);
    const validRuns = validRunsRaw.length > 0 ? validRunsRaw : runs;

    const totalDistM = validRuns.reduce((sum, r) => sum + r.distanceMeters, 0);
    const totalDistKm = totalDistM / 1000;
    const avgDistKm = validRuns.length > 0 ? totalDistKm / validRuns.length : 0;
    const maxDistKm = validRuns.length > 0 ? Math.max(...validRuns.map((r) => r.distanceMeters / 1000)) : 0;

    const runSummaries: RunSummary[] = validRuns.map((r, i) => {
      const distanceKm = parseFloat((r.distanceMeters / 1000).toFixed(2));
      const durationMin = Math.round(r.durationSeconds / 60);
      const paceStr =
        r.averagePaceSecondsPerKm != null && r.averagePaceSecondsPerKm > 0
          ? this.formatPaceFromSecondsPerKm(r.averagePaceSecondsPerKm)
          : 'N/A';
      return {
        index: i + 1,
        name: `Corrida ${i + 1}`,
        date: new Date(r.startDate).toLocaleDateString(),
        distanceKm,
        durationMin,
        avgPace: paceStr,
        avgHR: null,
        elevationGain: r.elevationGainMeters ?? null,
      };
    });

    const paceSum = validRuns.filter(
      (r) => r.averagePaceSecondsPerKm != null && r.averagePaceSecondsPerKm > 0,
    );
    const avgPaceSecondsPerKm =
      paceSum.length > 0
        ? paceSum.reduce((s, r) => s + (r.averagePaceSecondsPerKm ?? 0), 0) / paceSum.length
        : 0;
    const avgPace =
      avgPaceSecondsPerKm > 0 ? this.formatPaceFromSecondsPerKm(avgPaceSecondsPerKm) : 'N/A';

    return {
      runSummaries,
      avgDistKm,
      avgPace,
      avgHR: null,
      maxDistKm,
      totalDistKm,
      weekDates,
      trainingDays,
      availableDays,
    };
  }

  private formatPaceFromSecondsPerKm(paceSecondsPerKm: number): string {
    if (!paceSecondsPerKm || paceSecondsPerKm <= 0) return 'N/A';
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private async resolveTrainingPlan(
    userId: string,
    weekStartDate: string,
    activeGoalId?: string,
    goalSummary?: string,
    eventDate?: string | null,
  ) {
    const existing = await this.prisma.trainingPlan.findUnique({ where: { userId } });
    const targetDate = eventDate ? new Date(eventDate) : null;

    if (existing) {
      if (
        existing.status === TrainingPlanStatus.CANCELLED ||
        existing.status === TrainingPlanStatus.COMPLETED
      ) {
        throw new ConflictException(
          `Training plan is ${existing.status.toLowerCase()}. Delete it and create a new one before generating a plan.`,
        );
      }
      if (existing.status === TrainingPlanStatus.LOCKED) {
        throw new ConflictException('Training plan is locked and cannot be modified.');
      }
      const needsGoalUpdate = !!activeGoalId && existing.userGoalId !== activeGoalId;
      const existingTargetISO = existing.targetDate
        ? existing.targetDate.toISOString().split('T')[0]
        : null;
      const needsTargetUpdate = !!eventDate && existingTargetISO !== eventDate;
      if (needsGoalUpdate || needsTargetUpdate) {
        const data: Prisma.TrainingPlanUpdateInput = {};
        if (needsGoalUpdate) {
          data.userGoal = { connect: { id: activeGoalId! } };
          data.objective = goalSummary ?? existing.objective;
        }
        if (needsTargetUpdate) data.targetDate = targetDate;
        const updated = await this.prisma.trainingPlan.update({ where: { id: existing.id }, data });
        return updated;
      }
      return existing;
    }

    return this.prisma.trainingPlan.create({
      data: {
        userId,
        startDate: weekStartDate,
        objective: goalSummary ?? 'Plano de corrida gerado por IA',
        status: TrainingPlanStatus.ACTIVE,
        sports: [SportType.running],
        autoGenerate: true,
        userGoalId: activeGoalId ?? null,
        targetDate,
      },
    });
  }

  private async checkWeekOverlap(trainingPlanId: string, weekStartDate: Date, weekEndDate: Date) {
    const existing = await this.prisma.weeklyGoal.findFirst({
      where: {
        trainingPlanId,
        weekStartDate: { lte: weekEndDate },
        weekEndDate: { gte: weekStartDate },
      },
    });

    if (!existing) return;

    if (
      existing.status === WeeklyGoalStatus.GENERATED ||
      existing.status === WeeklyGoalStatus.LOCKED
    ) {
      throw new ConflictException(
        'A plan for this week already exists. Delete the existing weekly goal and its workouts before regenerating.',
      );
    }

    // PLANNED status → delete and overwrite
    await this.prisma.workout.deleteMany({ where: { weeklyGoalId: existing.id } });
    await this.prisma.weeklyGoal.delete({ where: { id: existing.id } });
  }

  /**
   * Resolves the current week's PlannedWeek (phase + volume targets) for a dated goal
   * and lazily lays out / extends the future PLANNED skeleton up to the event date.
   * Returns null for goals without a parseable dated target.
   */
  private async resolveCurrentPlannedWeek(params: {
    trainingPlanId: string;
    startDateISO: string;
    weekStartISO: string;
    weekEndDate: Date;
    goal: ParsedGoal | null;
    currentWeeklyVolumeKm: number;
    preReadMetrics: unknown;
  }): Promise<PlannedWeek | null> {
    const { goal } = params;
    if (!goal?.eventDate) return null;
    const targetDistanceMeters = parseTargetDistanceMeters(goal.targetDistance);
    if (targetDistanceMeters == null) return null;

    // A PLANNED row laid out by a previous skeleton build carries the stable phase/targets.
    const fromMetrics = this.plannedWeekFromMetrics(params.preReadMetrics);

    const macro = buildMacrocycle({
      startMondayISO: params.startDateISO,
      eventDate: goal.eventDate,
      targetDistanceMeters,
      currentWeeklyVolumeKm: params.currentWeeklyVolumeKm,
      experienceLevel: goal.experienceLevel ?? null,
    });
    if (macro.length === 0) return fromMetrics;

    await this.persistFutureSkeleton(params.trainingPlanId, macro, params.weekEndDate);

    // Prefer the persisted (stable) context; fall back to the in-memory current week.
    return fromMetrics ?? macro.find((w) => w.weekStartDate === params.weekStartISO) ?? null;
  }

  private plannedWeekFromMetrics(metrics: unknown): PlannedWeek | null {
    const m = metrics as Partial<PlannedWeek> | null;
    if (!m || typeof m !== 'object' || !m.phase) return null;
    return m as PlannedWeek;
  }

  /**
   * Creates PLANNED WeeklyGoal placeholders for every macrocycle week AFTER the current
   * one that does not already have a weekly goal. Idempotent: skips weeks already present,
   * so the skeleton is laid out once and survives subsequent generations.
   */
  private async persistFutureSkeleton(
    trainingPlanId: string,
    macro: PlannedWeek[],
    currentWeekEnd: Date,
  ): Promise<void> {
    const futureWeeks = macro.filter((w) => new Date(w.weekStartDate) > currentWeekEnd);
    for (const w of futureWeeks) {
      const start = new Date(w.weekStartDate);
      const end = new Date(w.weekEndDate);
      const exists = await this.prisma.weeklyGoal.findFirst({
        where: { trainingPlanId, weekStartDate: { lte: end }, weekEndDate: { gte: start } },
        select: { id: true },
      });
      if (exists) continue;
      await this.prisma.weeklyGoal.create({
        data: {
          trainingPlanId,
          weekStartDate: start,
          weekEndDate: end,
          status: WeeklyGoalStatus.PLANNED,
          metrics: w as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  /** Recomputes and stores the active goal's feasibility snapshot using the freshest VDOT. */
  private async refreshGoalFeasibility(
    goalId: string | undefined,
    goal: ParsedGoal | null,
    vdotScore: number | null,
    asOfISO: string,
  ): Promise<void> {
    if (!goalId || !goal?.eventDate || vdotScore == null) return;
    const feasibility = assessGoalFeasibility({
      goal: {
        targetDistance: goal.targetDistance,
        targetTime: goal.targetTime,
        eventDate: goal.eventDate,
        experienceLevel: goal.experienceLevel ?? null,
      },
      currentVdot: vdotScore,
      asOfISO,
      lowConfidence: false,
    });
    if (!feasibility) return;
    await this.prisma.userGoal.update({
      where: { id: goalId },
      data: { feasibility: feasibility as unknown as Prisma.InputJsonValue },
    });
  }

  private getNextMonday(): Date {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const monday = new Date(now);
    if (day === 0) {
      // Sunday: week is over, advance to next Monday
      monday.setDate(now.getDate() + 1);
    } else {
      // Mon–Sat: go back to Monday of the current week
      monday.setDate(now.getDate() - (day - 1));
    }
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private getWeekDates(monday: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  }

  /**
   * Derives the legacy `blocks` array. When the segments tree is empty
   * (validation wiped it, or the AI omitted it entirely) we synthesize a
   * placeholder so the workout is still visible on legacy iOS clients and
   * the user can see something instead of an empty card.
   */
  private deriveBlocksForPersistence(day: {
    segments?: unknown;
    description?: string;
    sportType: SportType;
  }) {
    const segments = (day.segments ?? []) as Parameters<typeof flattenToLegacyBlocks>[0];
    const derived = flattenToLegacyBlocks(segments);
    if (derived.length > 0) return derived;

    if (day.sportType === SportType.other) {
      return [{ type: 'rest', instructions: 'Dia de descanso completo.' }];
    }
    return [
      {
        type: 'main',
        instructions:
          day.description ?? 'Treino com formato inválido. Por favor, regenere a semana.',
      },
    ];
  }
}
