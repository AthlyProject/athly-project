import { serializeGenerationJob } from './generation-status';
import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
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

  // Workout saves must never reserve a generation or close another workout.
  async afterWorkout(
    _userId: string,
    _weeklyGoalId?: string | null,
  ): Promise<
    | {
        closed: boolean;
        generationId?: string;
        status?: string;
        pollAfterSeconds: number;
      }
    | undefined
  > {
    return undefined;
  }

  async resume(
    userId: string,
    retryFailed = false,
    now = new Date(),
    confirmation?: {
      confirmed?: boolean;
      trainingPlanId?: string;
      weekStartDate?: string;
    },
  ) {
    const noAction = {
      weekStartDate: null,
      generation: null,
      started: false,
      pendingGeneration: null,
    };
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
        if (confirmation?.confirmed) {
          // Workout mutations take these same week locks. Re-read eligibility only after locking.
          await tx.$queryRaw`SELECT id FROM weekly_goals WHERE training_plan_id = ${plan.id}
            AND week_start_date <= ${currentMonday} ORDER BY id FOR UPDATE`;
        }
        const source = await tx.weeklyGoal.findFirst({
          where: {
            trainingPlanId: plan.id,
            weekStartDate: { lte: currentMonday },
            status: { in: ['GENERATED', 'LOCKED'] },
            workouts: { some: { sportType: { not: 'other' } } },
          },
          orderBy: { weekStartDate: 'desc' },
          include: {
            workouts: {
              where: { sportType: { not: 'other' } },
              orderBy: { dateScheduled: 'desc' },
            },
          },
        });
        if (!source) return undefined; // First generation belongs to onboarding.
        const isCurrent = +source.weekStartDate === +currentMonday;
        const lastDate = source.workouts[0].dateScheduled;
        if (
          isCurrent &&
          (source.status !== 'GENERATED' ||
            !source.workouts
              .filter((w) => +w.dateScheduled === +lastDate)
              .every((w) => ['done', 'partial', 'skipped'].includes(w.status)))
        )
          return undefined;
        const target = isCurrent ? addCalendarDays(currentMonday, 7) : currentMonday;
        const window = resumePlanningWindow(plan.user.availableDays, context.timeZone, now);
        if (!isCurrent && !window) return undefined;
        const weekStartDate = target.toISOString().slice(0, 10);
        const pendingGeneration = {
          trainingPlanId: plan.id,
          sourceWeeklyGoalId: source.id,
          weekStartDate,
          reason: isCurrent ? 'last_workout' : 'resume',
        };
        if (
          confirmation?.confirmed &&
          (confirmation.trainingPlanId !== plan.id || confirmation.weekStartDate !== weekStartDate)
        )
          throw new ConflictException('O período mudou. Confira a semana e confirme novamente.');
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
        if (existingJob && existingJob.status !== 'FAILED') {
          return { job: existingJob, started: false, weekStartDate, pendingGeneration: null };
        }
        if (!confirmation?.confirmed || (existingJob && !retryFailed)) {
          return { job: existingJob, started: false, weekStartDate, pendingGeneration };
        }

        // Lock only open generated weeks. Never overwrite corrections made after a closure.
        const oldWeeks = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM weekly_goals WHERE training_plan_id = ${plan.id}
        AND week_end_date < ${target} AND status = 'GENERATED' AND closed_at IS NULL
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
          data: { closedAt: now, closureReason: pendingGeneration.reason },
        });
        const input = await this.contexts.generationInput(
          tx,
          userId,
          plan.id,
          target,
          context.payload,
          context.timeZone,
          isCurrent ? target : addCalendarDays(today, 1),
        );
        const job = await this.jobs.reserve(
          tx,
          userId,
          target,
          (isCurrent ? input : { ...input, resumeWindow: window }) as typeof input,
          plan.id,
          retryFailed,
        );
        return { job, started: true, weekStartDate, pendingGeneration: null };
      },
      { timeout: 15_000 },
    );
    if (!result) {
      if (confirmation?.confirmed)
        throw new ConflictException('A geração não está mais pendente. Atualize o plano.');
      return noAction;
    }
    if (result.started && result.job) await this.jobs.dispatch(result.job.id);
    if (result.started)
      this.logger.log(
        JSON.stringify({
          event: 'weekly_plan_resumed',
          reason: 'resume',
          userId,
          weekStartDate: result.weekStartDate,
          generationId: result.job?.id,
        }),
      );
    return {
      weekStartDate: result.weekStartDate,
      generation: result.job ? serializeGenerationJob(result.job) : null,
      pendingGeneration: result.pendingGeneration,
      started: result.started,
    };
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // Also recovers normal onboarding jobs whose initial SQS send failed.
      await this.jobs.dispatchPending();
    } catch (error) {
      this.logger.error(`Weekly automation: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}
