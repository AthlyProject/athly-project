import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { Prisma, SportType, TrainingPlanStatus, WeeklyGoalStatus, WorkoutStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { PlanNextWeekInput } from './dto/plan-next-week.input';
import type { AiPlannerInput, PlannerResults, RunSummary } from './types/planner.types';

@Injectable()
export class AiPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stravaService: StravaService,
    private readonly geminiService: GeminiService,
  ) {}

  async planNextWeek(userId: string, input: PlanNextWeekInput) {
    const startMonday = input.weekStartDate ? new Date(input.weekStartDate) : this.getNextMonday();
    const weekDates = this.getWeekDates(startMonday);
    const weekStartDate = new Date(weekDates[0]!);
    const weekEndDate = new Date(weekDates[6]!);

    // 1. Find or create TrainingPlan
    const trainingPlan = await this.resolveTrainingPlan(userId, weekDates[0]!);

    // 2. Check for existing WeeklyGoal overlap for this week
    await this.checkWeekOverlap(trainingPlan.id, weekStartDate, weekEndDate);

    // 3. Fetch user availability from DB
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { availability: true },
    });
    const trainingDays = user?.availability ?? 5;

    // 4. Fetch recent Strava activities (per-user token via IntegrationsService)
    const activities = await this.stravaService.getRecentActivities(userId, 30);
    const runs = activities
      .filter(
        (a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun',
      )
      .slice(0, trainingDays);

    // 5. Build AI input or use assessment path
    let plannerResult: PlannerResults;
    let isAssessment = false;

    if (runs.length === 0) {
      isAssessment = true;
      plannerResult = await this.geminiService.generateAssessmentPlan(weekDates, trainingDays);
    } else {
      const aiInput = this.buildAiInput(runs, weekDates, trainingDays);
      plannerResult = await this.geminiService.generatePlan(aiInput);
    }

    // 5. Persist: WeeklyGoal → Workouts (in transaction)
    const { weeklyGoal, workouts } = await this.prisma.$transaction(async (tx) => {
      const weeklyGoal = await tx.weeklyGoal.create({
        data: {
          trainingPlanId: trainingPlan.id,
          weekStartDate,
          weekEndDate,
          status: WeeklyGoalStatus.GENERATED,
          metrics: plannerResult.analysis as unknown as Prisma.InputJsonValue,
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
              sportType: day.sportType as SportType,
              title: day.title,
              description: day.description,
              blocks: day.blocks as unknown as Prisma.InputJsonValue,
              status: WorkoutStatus.scheduled,
              intensity: day.intensity,
            },
          }),
        ),
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

  private async resolveTrainingPlan(userId: string, weekStartDate: string) {
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
      return existing;
    }

    return this.prisma.trainingPlan.create({
      data: {
        userId,
        startDate: weekStartDate,
        objective: 'AI-generated running plan — run 5km in under 26 minutes',
        status: TrainingPlanStatus.ACTIVE,
        sports: [SportType.running],
        autoGenerate: true,
      },
    });
  }

  private async checkWeekOverlap(
    trainingPlanId: string,
    weekStartDate: Date,
    weekEndDate: Date,
  ) {
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
      return d.toISOString().split('T')[0]!;
    });
  }
}
