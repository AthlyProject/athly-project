import { Injectable, ConflictException, Logger } from '@nestjs/common';
import {
  Prisma,
  SportType,
  TrainingPlanStatus,
  WeeklyGoalStatus,
  WorkoutStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { AssessmentService } from '../assessment/assessment.service';
import { PlanNextWeekDto } from './dto/plan-next-week.dto';
import { PlanFromHealthDto } from './dto/plan-from-health.dto';
import type {
  AiPlannerInput,
  PlannerResults,
  PreviousWeekAnalysis,
  RunSummary,
} from './types/planner.types';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import type { ParsedGoal } from './prompts/goal-parser-prompt';
import type { UserProfileContext } from './prompts/planner-prompt';

const PROMPT_VERSION = 'v2.0';
const MODEL_USED = 'gemini-2.5-flash';

const DEFAULT_AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'];

@Injectable()
export class AiPlannerService {
  private readonly logger = new Logger(AiPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stravaService: StravaService,
    private readonly geminiService: GeminiService,
    private readonly effortZoneService: EffortZoneService,
    private readonly assessmentService: AssessmentService,
  ) {}

  async planNextWeek(userId: string, input: PlanNextWeekDto) {
    const startMonday = input.weekStartDate ? new Date(input.weekStartDate) : this.getNextMonday();
    const weekDates = this.getWeekDates(startMonday);
    const weekStartDate = new Date(weekDates[0]);
    const weekEndDate = new Date(weekDates[6]);

    // 1. Fetch active goal and assessment for context (before creating training plan)
    const [activeGoalRecord, assessmentRecord, user] = await Promise.all([
      this.prisma.userGoal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: 'desc' } }),
      this.assessmentService.findByUser(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { availableDays: true, dateOfBirth: true } }),
    ]);
    const activeGoal = activeGoalRecord ? (activeGoalRecord.parsedGoal as unknown as ParsedGoal) : null;
    const userProfile = assessmentRecord ? this.buildUserProfile(assessmentRecord.answers) : null;

    // 2. Find or create TrainingPlan (using goal for objective)
    const trainingPlan = await this.resolveTrainingPlan(
      userId,
      weekDates[0],
      activeGoalRecord?.id,
      activeGoal?.summary,
    );

    // 3. Check for existing WeeklyGoal overlap for this week
    await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);

    // 4. Fetch user available days from DB
    const availableDays = user?.availableDays?.length ? user.availableDays : DEFAULT_AVAILABLE_DAYS;
    const trainingDays = availableDays.length;

    // 5. Fetch recent Strava activities
    const activities = await this.stravaService.getRecentActivities(userId, 30);
    const runs = activities
      .filter((a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun')
      .slice(0, trainingDays);

    // 6. Calculate effort zones
    const runsForZones: RunDataForZones[] = runs.map((r) => ({
      distanceMeters: r.distance ?? 0,
      durationSeconds: r.moving_time ?? 0,
      averageHeartRate: r.average_heartrate ?? null,
      maxHeartRate: null,
    }));
    const effortZones = await this.effortZoneService.getOrCalculateForUser(userId, runsForZones, 'strava');

    // 7. Build previous week analysis
    const previousWeekAnalysis = await this.buildPreviousWeekAnalysis(trainingPlan.id, weekStartDate);

    // 8. Build AI input or use assessment path
    let plannerResult: PlannerResults;
    let isAssessment = false;

    if (runs.length === 0) {
      isAssessment = true;
      plannerResult = await this.geminiService.generateAssessmentPlan(weekDates, trainingDays, availableDays, effortZones, activeGoal, userProfile);
    } else {
      const aiInput = this.buildAiInput(runs, weekDates, trainingDays, availableDays);
      plannerResult = await this.geminiService.generatePlan(aiInput, effortZones, previousWeekAnalysis, activeGoal, userProfile);
    }

    // 8. Persist: WeeklyGoal → Workouts → AiReasoning (in transaction)
    const { weeklyGoal, workouts } = await this.prisma.$transaction(async (tx) => {
      const weeklyGoal = await tx.weeklyGoal.create({
        data: {
          trainingPlanId: trainingPlan.id,
          weekStartDate,
          weekEndDate,
          status: WeeklyGoalStatus.GENERATED,
          metrics: plannerResult.analysis as unknown as Prisma.InputJsonValue,
          previousWeekAnalysis: previousWeekAnalysis
            ? (previousWeekAnalysis as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const workouts = await Promise.all(
        plannerResult.weekPlan.map((day) =>
          tx.workout.create({
            data: {
              trainingPlanId: trainingPlan.id,
              weeklyGoalId: weeklyGoal.id,
              userId,
              dateScheduled: new Date(day.date),
              sportType: day.sportType,
              title: day.title,
              description: day.description,
              blocks: day.blocks as unknown as Prisma.InputJsonValue,
              status: WorkoutStatus.scheduled,
              intensity: day.intensity,
            },
          }),
        ),
      );

      // Persist AI reasoning for training days
      await Promise.all(
        plannerResult.weekPlan.map(async (day, idx) => {
          if (day.reasoning && day.sportType !== 'other') {
            await tx.aiReasoning.create({
              data: {
                workoutId: workouts[idx].id,
                weeklyGoalId: weeklyGoal.id,
                justification: day.reasoning,
                dataPointsUsed: {
                  avgPace: plannerResult.analysis.avgPace,
                  avgHeartRate: plannerResult.analysis.avgHeartRate,
                  totalDistanceKm: plannerResult.analysis.totalDistanceKm,
                  vdotScore: effortZones.vdotScore,
                  trend: plannerResult.analysis.trend,
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
      analysis: plannerResult.analysis,
      isAssessment,
    };
  }

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

    const aiInput = this.buildAiInputFromHealthRuns(input.runs, weekDates, trainingDays, availableDays);
    const plannerResult = await this.geminiService.generatePlan(aiInput, effortZones, previousWeekAnalysis, activeGoal, userProfile);

    const { weeklyGoal, workouts } = await this.prisma.$transaction(async (tx) => {
      const weeklyGoal = await tx.weeklyGoal.create({
        data: {
          trainingPlanId: trainingPlan.id,
          weekStartDate,
          weekEndDate,
          status: WeeklyGoalStatus.GENERATED,
          metrics: plannerResult.analysis as unknown as Prisma.InputJsonValue,
          previousWeekAnalysis: previousWeekAnalysis
            ? (previousWeekAnalysis as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });

      const workouts = await Promise.all(
        plannerResult.weekPlan.map((day) =>
          tx.workout.create({
            data: {
              trainingPlanId: trainingPlan.id,
              weeklyGoalId: weeklyGoal.id,
              userId,
              dateScheduled: new Date(day.date),
              sportType: day.sportType,
              title: day.title,
              description: day.description,
              blocks: day.blocks as unknown as Prisma.InputJsonValue,
              status: WorkoutStatus.scheduled,
              intensity: day.intensity,
            },
          }),
        ),
      );

      // Persist AI reasoning
      await Promise.all(
        plannerResult.weekPlan.map(async (day, idx) => {
          if (day.reasoning && day.sportType !== 'other') {
            await tx.aiReasoning.create({
              data: {
                workoutId: workouts[idx].id,
                weeklyGoalId: weeklyGoal.id,
                justification: day.reasoning,
                dataPointsUsed: {
                  avgPace: plannerResult.analysis.avgPace,
                  totalDistanceKm: plannerResult.analysis.totalDistanceKm,
                  vdotScore: effortZones.vdotScore,
                  trend: plannerResult.analysis.trend,
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
      analysis: plannerResult.analysis,
      isAssessment: false,
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

    // Estimate total distance from workout blocks
    let totalDistanceKm = 0;
    for (const w of trainingWorkouts.filter((w) => w.status === 'done')) {
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

  private buildAiInputFromHealthRuns(
    runs: PlanFromHealthDto['runs'],
    weekDates: string[],
    trainingDays: number,
    availableDays: string[],
  ): AiPlannerInput {
    const totalDistM = runs.reduce((sum, r) => sum + r.distanceMeters, 0);
    const totalDistKm = totalDistM / 1000;
    const avgDistKm = totalDistKm / runs.length;
    const maxDistKm = Math.max(...runs.map((r) => r.distanceMeters / 1000));

    const runSummaries: RunSummary[] = runs.map((r, i) => {
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

    const paceSum = runs.filter(
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

  private buildAiInput(
    runs: Awaited<ReturnType<InstanceType<typeof StravaService>['getRecentActivities']>>,
    weekDates: string[],
    trainingDays: number,
    availableDays: string[],
  ): AiPlannerInput {
    const totalDist = runs.reduce((sum, r) => sum + (r.distance ?? 0), 0);
    const avgDistKm = totalDist / runs.length / 1000;
    const avgSpeed = runs.reduce((sum, r) => sum + (r.average_speed ?? 0), 0) / runs.length;

    const hrRuns = runs.filter((r) => r.average_heartrate);
    const avgHR =
      hrRuns.length > 0
        ? Math.round(hrRuns.reduce((sum, r) => sum + r.average_heartrate!, 0) / hrRuns.length)
        : null;

    const maxDistKm = Math.max(...runs.map((r) => r.distance ?? 0)) / 1000;
    const totalDistKm = totalDist / 1000;

    const runSummaries: RunSummary[] = runs.map((r, i) => ({
      index: i + 1,
      name: r.name,
      date: new Date(r.start_date).toLocaleDateString(),
      distanceKm: parseFloat(((r.distance ?? 0) / 1000).toFixed(2)),
      durationMin: r.moving_time ? Math.round(r.moving_time / 60) : null,
      avgPace: this.formatPace(r.average_speed ?? 0),
      avgHR: r.average_heartrate ? Math.round(r.average_heartrate) : null,
      elevationGain: r.total_elevation_gain ?? null,
    }));

    return {
      runSummaries,
      avgDistKm,
      avgPace: this.formatPace(avgSpeed),
      avgHR,
      maxDistKm,
      totalDistKm,
      weekDates,
      trainingDays,
      availableDays,
    };
  }

  private formatPace(speedMs: number): string {
    if (!speedMs || speedMs <= 0) return 'N/A';
    const paceSecondsPerKm = 1000 / speedMs;
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getNextMonday(): Date {
    const now = new Date();
    const day = now.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);
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
}
