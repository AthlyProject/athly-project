import { serializeGenerationJob } from './generation-status';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BillingService } from '../billing/billing.service';
import { PlannerHealthContextService } from './planner-health-context.service';
import { PlanGenerationJobsService } from './plan-generation-jobs.service';
import { addCalendarDays, localCalendar, mondayOf, resumePlanningWindow } from './weekly-calendar';

@Injectable()
export class WeeklyPlanAutomationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WeeklyPlanAutomationService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    private readonly contexts: PlannerHealthContextService,
    private readonly jobs: PlanGenerationJobsService,
  ) {}

  get enabled() {
    return this.config.get<string>('WEEKLY_PLAN_AUTOMATION_ENABLED', 'false') === 'true';
  }

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
    void this.tick();
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async afterWorkout(userId: string, weeklyGoalId?: string | null) {
    if (!this.enabled || !weeklyGoalId) return undefined;
    try {
      return await this.closeWeek(userId, weeklyGoalId);
    } catch (error) {
      // The scheduled sweep also detects a terminal last workout and retries this closure.
      this.logger.error(
        `Weekly closure pending ${weeklyGoalId}: ${error instanceof Error ? error.message : error}`,
      );
      return undefined;
    }
  }

  async closeWeek(userId: string, weeklyGoalId: string, now = new Date()) {
    if (!this.enabled || !(await this.billing.isEntitled(userId))) return undefined;
    const context = await this.prisma.plannerHealthContext.findUnique({ where: { userId } });
    if (!context) return undefined;
    const result = await this.prisma.$transaction(
      async (tx) => {
        // All automation takes the plan lock before week locks, including foreground resumption.
        await tx.$queryRaw`SELECT id FROM training_plans WHERE user_id = ${userId} FOR NO KEY UPDATE`;
        await tx.$queryRaw`SELECT id FROM weekly_goals WHERE id = ${weeklyGoalId} FOR UPDATE`;
        const week = await tx.weeklyGoal.findFirst({
          where: {
            id: weeklyGoalId,
            trainingPlan: { userId, status: 'ACTIVE', autoGenerate: true },
          },
          include: {
            workouts: {
              where: { sportType: { not: 'other' } },
              orderBy: { dateScheduled: 'desc' },
            },
          },
        });
        if (!week || week.closedAt || week.status !== 'GENERATED' || !week.workouts.length)
          return undefined;
        const local = localCalendar(now, context.timeZone);
        if (week.weekStartDate > local.date) return undefined;
        // Don't close historical weeks on rollout. The current/recent week remains eligible on restart.
        if (week.weekEndDate < mondayOf(localCalendar(context.createdAt, context.timeZone).date))
          return undefined;
        const lastDate = week.workouts[0].dateScheduled.toISOString().slice(0, 10);
        const lastFinished = week.workouts
          .filter((w) => w.dateScheduled.toISOString().slice(0, 10) === lastDate)
          .every((w) => ['done', 'partial', 'skipped'].includes(w.status));
        if (!lastFinished) return undefined;
        const reason = 'last_workout';
        await tx.workout.updateMany({
          where: { weeklyGoalId, userId, status: 'scheduled', sportType: { not: 'other' } },
          data: { status: 'skipped' },
        });
        await tx.weeklyGoal.update({
          where: { id: weeklyGoalId },
          data: { closedAt: now, closureReason: reason },
        });
        const nextMonday = addCalendarDays(week.weekStartDate, 7);
        const existingWeek = await tx.weeklyGoal.findFirst({
          where: {
            trainingPlanId: week.trainingPlanId,
            weekStartDate: nextMonday,
            status: { in: ['GENERATED', 'LOCKED'] },
            workouts: { some: {} },
          },
        });
        if (existingWeek) return { job: undefined, reason, weekStartDate: nextMonday };
        const input = await this.contexts.generationInput(
          tx,
          userId,
          week.trainingPlanId,
          nextMonday,
          context.payload,
          context.timeZone,
        );
        const job = await this.jobs.reserve(tx, userId, nextMonday, input, week.trainingPlanId);
        return { job, reason, weekStartDate: nextMonday };
      },
      { timeout: 15_000 },
    );
    if (!result) return undefined;
    this.logger.log(
      JSON.stringify({
        event: 'weekly_plan_closed',
        userId,
        weeklyGoalId,
        reason: result.reason,
        nextWeek: result.weekStartDate.toISOString().slice(0, 10),
        snapshotAgeSeconds: Math.max(0, (now.getTime() - context.capturedAt.getTime()) / 1000),
        generationId: result.job?.id,
      }),
    );
    if (result.job) await this.jobs.dispatch(result.job.id);
    return {
      closed: true,
      generationId: result.job?.id,
      status: result.job?.status.toLowerCase(),
      pollAfterSeconds: 5,
    };
  }

  async resume(userId: string, retryFailed = false, now = new Date()) {
    const noAction = { weekStartDate: null, generation: null, started: false };
    if (!this.enabled || !(await this.billing.isEntitled(userId))) return noAction;
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM training_plans WHERE user_id = ${userId} FOR NO KEY UPDATE`;
        const plan = await tx.trainingPlan.findFirst({
          where: { userId, status: 'ACTIVE', autoGenerate: true },
          include: { user: { select: { availableDays: true, plannerHealthContext: true } } },
        });
        const context = plan?.user.plannerHealthContext;
        if (!plan || !context) return undefined;
        const today = localCalendar(now, context.timeZone).date;
        const currentMonday = mondayOf(today);
        const history = await tx.weeklyGoal.findFirst({
          where: {
            trainingPlanId: plan.id,
            weekEndDate: { lt: currentMonday },
            status: { in: ['GENERATED', 'LOCKED'] },
            workouts: { some: { sportType: { not: 'other' } } },
          },
          select: { id: true },
        });
        if (!history) return undefined; // Onboarding owns the first generation.
        const window = resumePlanningWindow(plan.user.availableDays, context.timeZone, now);
        if (!window) return undefined;
        const target = new Date(window.weekStartDate);
        const existingWeek = await tx.weeklyGoal.findUnique({
          where: {
            trainingPlanId_weekStartDate: { trainingPlanId: plan.id, weekStartDate: target },
          },
        });
        if (existingWeek && ['GENERATED', 'LOCKED', 'CANCELLED'].includes(existingWeek.status))
          return undefined;
        const existingJob = await tx.planGenerationJob.findUnique({
          where: { userId_weekStartDate: { userId, weekStartDate: target } },
        });
        if (existingJob && (existingJob.status !== 'FAILED' || !retryFailed)) {
          return { job: existingJob, started: false, weekStartDate: window.weekStartDate };
        }

        // Lock only open generated weeks. Never overwrite corrections made after a closure.
        const oldWeeks = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM weekly_goals WHERE training_plan_id = ${plan.id}
        AND week_end_date < ${currentMonday} AND status = 'GENERATED' AND closed_at IS NULL
        ORDER BY id FOR UPDATE`;
        const ids = oldWeeks.map((week) => week.id);
        await tx.workout.updateMany({
          where: {
            userId,
            weeklyGoalId: { in: ids },
            status: 'scheduled',
            sportType: { not: 'other' },
          },
          data: { status: 'skipped' },
        });
        await tx.weeklyGoal.updateMany({
          where: { id: { in: ids } },
          data: { closedAt: now, closureReason: 'resume' },
        });
        const input = await this.contexts.generationInput(
          tx,
          userId,
          plan.id,
          target,
          context.payload,
          context.timeZone,
          addCalendarDays(today, 1),
        );
        const job = await this.jobs.reserve(
          tx,
          userId,
          target,
          { ...input, resumeWindow: window } as typeof input,
          plan.id,
          retryFailed,
        );
        return { job, started: true, weekStartDate: window.weekStartDate };
      },
      { timeout: 15_000 },
    );
    if (!result) return noAction;
    await this.jobs.dispatch(result.job.id);
    if (result.started)
      this.logger.log(
        JSON.stringify({
          event: 'weekly_plan_resumed',
          reason: 'resume',
          userId,
          weekStartDate: result.weekStartDate,
          generationId: result.job.id,
        }),
      );
    return {
      weekStartDate: result.weekStartDate,
      generation: serializeGenerationJob(result.job),
      started: result.started,
    };
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Also recovers normal onboarding jobs whose initial SQS send failed.
      await this.jobs.dispatchPending();
      if (!this.enabled) return;
      let cursor: string | undefined;
      do {
        const weeks = await this.prisma.weeklyGoal.findMany({
          where: {
            closedAt: null,
            status: 'GENERATED',
            trainingPlan: {
              status: 'ACTIVE',
              autoGenerate: true,
              user: { plannerHealthContext: { isNot: null } },
            },
          },
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, trainingPlan: { select: { userId: true } } },
        });
        for (const week of weeks) await this.afterWorkout(week.trainingPlan.userId, week.id);
        cursor = weeks.length === 100 ? weeks[weeks.length - 1].id : undefined;
      } while (cursor);
    } catch (error) {
      this.logger.error(`Weekly automation: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}
