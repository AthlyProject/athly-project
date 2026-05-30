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
import { PlanFromHealthDto, DetailedSessionDto } from './dto/plan-from-health.dto';
import type {
  AiPlannerInput,
  PreviousWeekAnalysis,
  RunSummary,
} from './types/planner.types';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './prompts/goal-parser-prompt';
import type { UserProfileContext, LongitudinalWeek } from './prompts/planner-prompt';
import { flattenToLegacyBlocks } from '../workouts/utils/flatten-to-legacy';
import { SEGMENT_SCHEMA_VERSION } from '../workouts/types/segment.types';

const PROMPT_VERSION = 'v3.0';
const MODEL_USED = 'gemini-2.5-flash';
const DETAILED_FIRST_GEN = 5;
const DETAILED_MID_PLAN = 7;
const HISTORICAL_FIRST_GEN = 20;
const LONGITUDINAL_WEEKS = 4;

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
    );
    await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);

    const availableDays = userHealth?.availableDays?.length ? userHealth.availableDays : DEFAULT_AVAILABLE_DAYS;
    const trainingDays = availableDays.length;

    // Calculate effort zones from health runs
    const runsForZones: RunDataForZones[] = input.runs.map((r) => ({
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
      averageHeartRate: null,
      maxHeartRate: null,
    }));
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
          previousWeekAnalysis,
          activeGoal,
          userProfile,
          analyzedSessions,
          longitudinalWeeks,
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
    // Find the most recent weekly goal before current week
    const previousGoal = await this.prisma.weeklyGoal.findFirst({
      where: {
        trainingPlanId,
        weekEndDate: { lt: currentWeekStart },
      },
      orderBy: { weekStartDate: 'desc' },
      include: {
        workouts: {
          include: {
            feedback: true,
          },
        },
      },
    });

    if (!previousGoal) return null;

    const workouts = previousGoal.workouts;
    const trainingWorkouts = workouts.filter((w) => w.sportType !== 'other');
    const completedWorkouts = trainingWorkouts.filter((w) => w.status === 'done').length;
    const totalWorkouts = trainingWorkouts.length;
    const skippedWorkouts = trainingWorkouts
      .filter((w) => w.status === 'skipped')
      .map((w) => w.title);

    // Calculate avg effort and fatigue from feedback
    const allFeedback = trainingWorkouts.flatMap((w) => w.feedback);
    const avgEffort = allFeedback.length > 0
      ? parseFloat((allFeedback.reduce((sum, f) => sum + f.effort, 0) / allFeedback.length).toFixed(1))
      : null;
    const avgFatigue = allFeedback.length > 0
      ? parseFloat((allFeedback.reduce((sum, f) => sum + f.fatigue, 0) / allFeedback.length).toFixed(1))
      : null;

    // Soma distância: prefere actualDistanceMeters (HK linkado) e cai pra blocks como fallback.
    let totalDistanceKm = 0;
    for (const w of trainingWorkouts.filter((w) => w.status === 'done')) {
      if (typeof w.actualDistanceMeters === 'number' && w.actualDistanceMeters > 0) {
        totalDistanceKm += w.actualDistanceMeters / 1000;
        continue;
      }
      const blocks = w.blocks as any[];
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block.distanceKm) totalDistanceKm += block.distanceKm;
        }
      }
    }

    // Compare with current week's metrics to determine volume change
    const prevMetrics = previousGoal.metrics as any;
    const prevTotalDist = prevMetrics?.totalDistanceKm ?? 0;
    let volumeChange = 'sem dados anteriores';
    if (prevTotalDist > 0 && totalDistanceKm > 0) {
      const pctChange = ((totalDistanceKm - prevTotalDist) / prevTotalDist) * 100;
      if (pctChange > 5) volumeChange = `aumentou ${Math.round(pctChange)}%`;
      else if (pctChange < -5) volumeChange = `reduziu ${Math.round(Math.abs(pctChange))}%`;
      else volumeChange = 'manteve';
    }

    const completionRate = totalWorkouts > 0 ? parseFloat((completedWorkouts / totalWorkouts).toFixed(2)) : 0;
    const adherenceNote = `Atleta completou ${completedWorkouts}/${totalWorkouts} treinos${skippedWorkouts.length > 0 ? `, pulou: ${skippedWorkouts.join(', ')}` : ''}`;

    return {
      completedWorkouts,
      totalWorkouts,
      completionRate,
      totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
      avgEffort,
      avgFatigue,
      skippedWorkouts,
      volumeChange,
      adherenceNote,
    };
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

    // Oldest-first so the AI reads chronological progression naturally.
    return recent.reverse().map((goal, idx) => {
      const workouts = goal.workouts.filter((w) => w.sportType !== 'other');
      const doneWorkouts = workouts.filter((w) => w.status === 'done');
      const completionRate =
        workouts.length > 0 ? parseFloat((doneWorkouts.length / workouts.length).toFixed(2)) : 0;

      // Soma totalKm a partir dos actuals (HK linkado) — fallback para blocks, depois para metrics histórico.
      let totalKm = 0;
      for (const w of doneWorkouts) {
        if (typeof w.actualDistanceMeters === 'number' && w.actualDistanceMeters > 0) {
          totalKm += w.actualDistanceMeters / 1000;
          continue;
        }
        const blocks = (w.blocks as any[]) ?? [];
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block?.distanceKm) totalKm += block.distanceKm;
          }
        }
      }
      if (totalKm === 0) {
        const metrics = (goal.metrics ?? {}) as { totalDistanceKm?: number };
        totalKm = metrics.totalDistanceKm ?? 0;
      }

      const metrics = (goal.metrics ?? {}) as { avgPace?: string };

      const allFeedback = workouts.flatMap((w) => w.feedback);
      const avgEffort =
        allFeedback.length > 0
          ? parseFloat(
              (allFeedback.reduce((sum, f) => sum + f.effort, 0) / allFeedback.length).toFixed(1),
            )
          : null;

      return {
        weekLabel: `W-${recent.length - idx}`,
        totalKm: parseFloat(totalKm.toFixed(2)),
        avgPace: metrics.avgPace ?? 'N/A',
        completionRate,
        avgEffort,
      };
    });
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

  private async resolveTrainingPlan(userId: string, weekStartDate: string, activeGoalId?: string, goalSummary?: string) {
    const existing = await this.prisma.trainingPlan.findUnique({ where: { userId } });

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
      // Update goal reference if provided and not yet linked
      if (activeGoalId && existing.userGoalId !== activeGoalId) {
        await this.prisma.trainingPlan.update({
          where: { id: existing.id },
          data: { userGoalId: activeGoalId, objective: goalSummary ?? existing.objective },
        });
        return { ...existing, userGoalId: activeGoalId, objective: goalSummary ?? existing.objective };
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
