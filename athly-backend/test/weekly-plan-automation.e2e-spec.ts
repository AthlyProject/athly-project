import {
  ResumePlanningWindow,
  resumeWindowAtExecution,
} from '../src/modules/ai-planner/weekly-calendar';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaClient, WorkoutStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PlannerHealthContextService } from '../src/modules/ai-planner/planner-health-context.service';
import { PlanGenerationJobsService } from '../src/modules/ai-planner/plan-generation-jobs.service';
import { WeeklyPlanAutomationService } from '../src/modules/ai-planner/weekly-plan-automation.service';
import { PlanGenerationSqsConsumer } from '../src/modules/ai-planner/plan-generation-sqs.consumer';
import { WorkoutsService } from '../src/modules/workouts/workouts.service';

// Explicit opt-in, isolated database only; never uses the application's DATABASE_URL.
const url = process.env.WEEKLY_AUTOMATION_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite('weekly automation (PostgreSQL transactions)', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const sqs = { send: jest.fn().mockResolvedValue(undefined) };
  const billing = { isEntitled: jest.fn().mockResolvedValue(true) };
  const config = new ConfigService({ WEEKLY_PLAN_AUTOMATION_ENABLED: 'true' });
  const contexts = new PlannerHealthContextService(prisma as any);
  const jobs = new PlanGenerationJobsService(prisma as any, sqs as any);
  const automation = new WeeklyPlanAutomationService(
    prisma as any,
    config,
    billing as any,
    contexts,
    jobs,
  );
  const workouts = new WorkoutsService(prisma as any, automation, contexts);
  const users: string[] = [];
  const friday = new Date('2026-09-11T18:00:00Z');

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  beforeEach(() => {
    sqs.send.mockReset().mockResolvedValue(undefined);
    billing.isEntitled.mockResolvedValue(true);
    config.set('WEEKLY_PLAN_AUTOMATION_ENABLED', 'true');
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
    jest.restoreAllMocks();
  });

  async function fixture(lastStatus: WorkoutStatus = 'done', withContext = true) {
    const user = await prisma.user.create({
      data: { name: 'Automation test', email: `${randomUUID()}@example.test`, goals: [] },
    });
    users.push(user.id);
    const plan = await prisma.trainingPlan.create({
      data: {
        userId: user.id,
        startDate: '2026-09-07',
        objective: 'Run',
        sports: ['running'],
        status: 'ACTIVE',
        autoGenerate: true,
      },
    });
    const week = await prisma.weeklyGoal.create({
      data: {
        trainingPlanId: plan.id,
        weekStartDate: new Date('2026-09-07'),
        weekEndDate: new Date('2026-09-13'),
        status: 'GENERATED',
        metrics: {},
      },
    });
    const create = (
      date: string,
      status: WorkoutStatus,
      sportType: 'running' | 'other' = 'running',
    ) =>
      prisma.workout.create({
        data: {
          userId: user.id,
          trainingPlanId: plan.id,
          weeklyGoalId: week.id,
          dateScheduled: new Date(date),
          title: 'Run',
          blocks: [],
          sportType,
          status,
        },
      });
    const earlier = await create('2026-09-08', 'scheduled');
    const last = await create('2026-09-11', lastStatus);
    const rest = await create('2026-09-13', 'scheduled', 'other');
    if (withContext)
      await prisma.plannerHealthContext.create({
        data: {
          userId: user.id,
          timeZone: 'America/Sao_Paulo',
          capturedAt: friday,
          createdAt: new Date('2026-09-07'),
          payload: { runs: [] },
        },
      });
    return { user, plan, week, earlier, last, rest, create };
  }

  it.each<WorkoutStatus>(['done', 'partial', 'skipped'])(
    'closes on final scheduled workout %s, skipping earlier pending workouts and ignoring rest',
    async (status) => {
      const f = await fixture(status);
      const result = await automation.closeWeek(f.user.id, f.week.id, friday);
      expect(result).toMatchObject({ closed: true, status: 'queued' });
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.earlier.id } })).status).toBe(
        'skipped',
      );
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.rest.id } })).status).toBe(
        'scheduled',
      );
      const job = await prisma.planGenerationJob.findUniqueOrThrow({
        where: { id: result!.generationId },
      });
      expect(job.weekStartDate.toISOString()).toBe('2026-09-14T00:00:00.000Z');
      expect(job.payload).toMatchObject({ weekStartDate: '2026-09-14' });
      expect(sqs.send).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for every workout on the last scheduled date', async () => {
    const f = await fixture();
    await f.create('2026-09-11', 'scheduled');
    expect(await automation.closeWeek(f.user.id, f.week.id, friday)).toBeUndefined();
  });

  it('Sunday cutoff skips all pending workouts including the last, using the persisted snapshot', async () => {
    const f = await fixture('scheduled');
    expect(
      await automation.closeWeek(f.user.id, f.week.id, new Date('2026-09-14T01:59:59Z')),
    ).toBeUndefined();
    expect(
      await automation.closeWeek(f.user.id, f.week.id, new Date('2026-09-14T02:00:00Z')),
    ).toMatchObject({ closed: true });
    expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.last.id } })).status).toBe(
      'skipped',
    );
    expect(
      (await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: f.week.id } })).closureReason,
    ).toBe('sunday');
  });

  it('reserves one job even when independent API requests race before a job exists', async () => {
    const f = await fixture();
    const requests = await Promise.all(
      Array.from({ length: 8 }, () =>
        jobs.reserve(prisma, f.user.id, new Date('2026-09-14'), { runs: [] }),
      ),
    );
    expect(new Set(requests.map((job) => job.id)).size).toBe(1);
    await Promise.all(requests.map((job) => jobs.dispatch(job.id)));
    expect(sqs.send).toHaveBeenCalledTimes(1);
  });

  it('handles racing first health uploads without losing the newest snapshot', async () => {
    const f = await fixture('scheduled', false);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        contexts.sync(f.user.id, {
          runs: [
            { startDate: '2026-09-11T10:00:00Z', distanceMeters: 1000 + i, durationSeconds: 300 },
          ],
          timeZone: 'America/Sao_Paulo',
          capturedAt: new Date(friday.getTime() + i).toISOString(),
        }),
      ),
    );
    expect(
      (await prisma.plannerHealthContext.findUniqueOrThrow({ where: { userId: f.user.id } }))
        .payload,
    ).toMatchObject({ runs: [expect.objectContaining({ distanceMeters: 1007 })] });
  });

  it('serializes simultaneous closure requests and dispatches exactly once', async () => {
    const f = await fixture();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => automation.closeWeek(f.user.id, f.week.id, friday)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await prisma.planGenerationJob.count({ where: { userId: f.user.id } })).toBe(1);
    expect(sqs.send).toHaveBeenCalledTimes(1);
  });

  it('never regenerates after unlinking/recompleting a closed week', async () => {
    const f = await fixture();
    const first = await automation.closeWeek(f.user.id, f.week.id, friday);
    await workouts.uncompleteWorkout(f.user.id, f.last.id);
    const completed = await workouts.completeWorkout(f.user.id, f.last.id);
    expect(completed.nextWeekGeneration).toBeUndefined();
    expect(await prisma.planGenerationJob.count({ where: { userId: f.user.id } })).toBe(1);
    expect(first!.generationId).toBeDefined();
  });

  it('keeps a committed closure/job during a queue outage and recovers dispatch later', async () => {
    const f = await fixture();
    sqs.send.mockRejectedValueOnce(new Error('SQS unavailable'));
    const result = await automation.closeWeek(f.user.id, f.week.id, friday);
    expect(result!.generationId).toBeDefined();
    expect(
      (await prisma.planGenerationJob.findUniqueOrThrow({ where: { id: result!.generationId } }))
        .enqueuedAt,
    ).toBeNull();
    await jobs.dispatchPending();
    expect(
      (await prisma.planGenerationJob.findUniqueOrThrow({ where: { id: result!.generationId } }))
        .enqueuedAt,
    ).not.toBeNull();
  });

  it('enforces eligibility and enrollment without closing historical weeks on first sync', async () => {
    const f = await fixture('done', false);
    expect(await automation.closeWeek(f.user.id, f.week.id, friday)).toBeUndefined();
    await contexts.sync(f.user.id, {
      runs: [],
      timeZone: 'America/Sao_Paulo',
      capturedAt: friday.toISOString(),
    });
    // createdAt is now, after this historical week.
    expect(
      await automation.closeWeek(f.user.id, f.week.id, new Date('2026-09-21')),
    ).toBeUndefined();
    const eligible = await fixture();
    billing.isEntitled.mockResolvedValue(false);
    expect(await automation.closeWeek(eligible.user.id, eligible.week.id, friday)).toBeUndefined();
    billing.isEntitled.mockResolvedValue(true);
    config.set('WEEKLY_PLAN_AUTOMATION_ENABLED', 'false');
    expect(await automation.closeWeek(eligible.user.id, eligible.week.id, friday)).toBeUndefined();
    config.set('WEEKLY_PLAN_AUTOMATION_ENABLED', 'true');
    await prisma.trainingPlan.update({
      where: { id: eligible.plan.id },
      data: { autoGenerate: false },
    });
    expect(await automation.closeWeek(eligible.user.id, eligible.week.id, friday)).toBeUndefined();
  });

  it('does not enqueue a next week that already exists', async () => {
    const f = await fixture();
    const next = await prisma.weeklyGoal.create({
      data: {
        trainingPlanId: f.plan.id,
        weekStartDate: new Date('2026-09-14'),
        weekEndDate: new Date('2026-09-20'),
        status: 'GENERATED',
        metrics: {},
      },
    });
    await prisma.workout.create({
      data: {
        userId: f.user.id,
        trainingPlanId: f.plan.id,
        weeklyGoalId: next.id,
        dateScheduled: new Date('2026-09-15'),
        title: 'Existing',
        blocks: [],
        sportType: 'running',
        status: 'scheduled',
      },
    });
    expect(await automation.closeWeek(f.user.id, f.week.id, friday)).toMatchObject({
      closed: true,
      generationId: undefined,
    });
    expect(sqs.send).not.toHaveBeenCalled();
  });

  it('accepts same-week rescheduling and rejects both previous and following weeks', async () => {
    const f = await fixture('scheduled');
    await expect(
      workouts.updateWorkout(f.user.id, f.last.id, { date: '2026-09-12' }),
    ).resolves.toMatchObject({ date: '2026-09-12' });
    await expect(
      workouts.updateWorkout(f.user.id, f.last.id, { date: '2026-09-14' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      workouts.updateWorkout(f.user.id, f.last.id, { date: '2026-09-06' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('preserves the newer health snapshot and enriches it with saved execution without duplicates', async () => {
    const f = await fixture();
    const uuid = randomUUID();
    const run = {
      appleHealthWorkoutUUID: uuid,
      startDate: '2026-09-11T10:00:00.000Z',
      distanceMeters: 5000,
      durationSeconds: 1800,
    };
    await contexts.sync(f.user.id, {
      runs: [run],
      timeZone: 'America/Sao_Paulo',
      capturedAt: friday.toISOString(),
    });
    await contexts.sync(f.user.id, {
      runs: [],
      timeZone: 'UTC',
      capturedAt: '2026-09-10T00:00:00Z',
    });
    const saved = await prisma.plannerHealthContext.findUniqueOrThrow({
      where: { userId: f.user.id },
    });
    expect(saved.timeZone).toBe('America/Sao_Paulo');
    await prisma.workout.update({
      where: { id: f.last.id },
      data: {
        appleHealthWorkoutUUID: uuid,
        actualDistanceMeters: 5000,
        actualDurationSeconds: 1800,
        executionDetails: { ...run, startDate: '2026-09-11T10:00:00Z', segments: [] },
      },
    });
    const input = await contexts.generationInput(
      prisma,
      f.user.id,
      f.plan.id,
      new Date('2026-09-14'),
      saved.payload,
    );
    expect(input.runs).toHaveLength(1);
    expect(input.detailedSessions![0].athlyWorkoutId).toBe(f.last.id);
  });

  it('rolls back skipping/closure if reserving the job fails', async () => {
    const f = await fixture();
    const spy = jest.spyOn(jobs, 'reserve').mockRejectedValueOnce(new Error('reservation failed'));
    await expect(automation.closeWeek(f.user.id, f.week.id, friday)).rejects.toThrow(
      'reservation failed',
    );
    spy.mockRestore();
    expect(
      (await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: f.week.id } })).closedAt,
    ).toBeNull();
    expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.earlier.id } })).status).toBe(
      'scheduled',
    );
  });

  it('keeps late Sunday runs in the local week and excludes Monday runs', async () => {
    const f = await fixture();
    const input = await contexts.generationInput(
      prisma,
      f.user.id,
      f.plan.id,
      new Date('2026-09-14'),
      {
        runs: [
          { startDate: '2026-09-14T01:00:00Z', distanceMeters: 5000, durationSeconds: 1800 },
          { startDate: '2026-09-14T10:00:00Z', distanceMeters: 6000, durationSeconds: 2000 },
        ],
      },
      'America/Sao_Paulo',
    );
    expect(input.runs).toHaveLength(1);
    expect(input.runs[0].startDate).toBe('2026-09-14T01:00:00Z');
  });

  it('captures the final completion metrics before reserving the generation', async () => {
    const f = await fixture('scheduled');
    const result = await workouts.completeWorkout(f.user.id, f.last.id, {
      actualDistanceMeters: 7000,
      actualDurationSeconds: 2500,
    });
    expect(result.status).toBe('done');
    const job = await prisma.planGenerationJob.findUniqueOrThrow({
      where: { id: result.nextWeekGeneration!.generationId },
    });
    expect(job.payload).toMatchObject({
      runs: [expect.objectContaining({ distanceMeters: 7000, durationSeconds: 2500 })],
    });
  });

  it('does not resurrect a removed HealthKit association from an old snapshot', async () => {
    const f = await fixture('scheduled');
    const input = await contexts.generationInput(
      prisma,
      f.user.id,
      f.plan.id,
      new Date('2026-09-14'),
      {
        runs: [],
        detailedSessions: [
          {
            startDate: '2026-09-11T10:00:00Z',
            athlyWorkoutId: f.last.id,
            distanceMeters: 5000,
            durationSeconds: 1800,
            segments: [],
          },
        ],
      },
    );
    expect(input.detailedSessions![0].athlyWorkoutId).toBeUndefined();
  });

  it('retries failed consumers with backoff, terminates at three failures, and allows explicit retry', async () => {
    const f = await fixture();
    const input = { runs: [], weekStartDate: '2026-09-14' };
    const job = await jobs.reserve(prisma, f.user.id, new Date('2026-09-14'), input);
    const planner = {
      planFromHealth: jest.fn().mockRejectedValue(new Error('temporary generation failure')),
    };
    const consumer = new PlanGenerationSqsConsumer(planner as any, prisma as any);
    (consumer as any).client = { send: jest.fn().mockResolvedValue({}) };
    const msg = {
      Body: JSON.stringify({ generationId: job.id, userId: f.user.id }),
      ReceiptHandle: 'test',
    };
    for (let attempt = 1; attempt <= 3; attempt++) {
      await (consumer as any).processMessage(msg);
      const updated = await prisma.planGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(updated.attempts).toBe(attempt);
      expect(updated.status).toBe(attempt === 3 ? 'FAILED' : 'QUEUED');
      if (attempt < 3) {
        expect(updated.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
        await (consumer as any).processMessage(msg);
        expect(planner.planFromHealth).toHaveBeenCalledTimes(attempt);
        await prisma.planGenerationJob.update({
          where: { id: job.id },
          data: { leaseExpiresAt: new Date(0) },
        });
      }
    }
    await (consumer as any).processMessage(msg);
    expect(planner.planFromHealth).toHaveBeenCalledTimes(3);
    const retry = await jobs.reserve(
      prisma,
      f.user.id,
      new Date('2026-09-14'),
      input,
      undefined,
      true,
    );
    expect(retry).toMatchObject({ id: job.id, status: 'QUEUED', attempts: 0, enqueuedAt: null });
  });

  it('reclaims an expired consumer lease and fences failure updates from the old owner', async () => {
    const f = await fixture();
    const job = await jobs.reserve(prisma, f.user.id, new Date('2026-09-14'), { runs: [] });
    await prisma.planGenerationJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', leaseOwner: 'dead-worker', leaseExpiresAt: new Date(0) },
    });
    const planner = {
      planFromHealth: jest.fn(async () => {
        await prisma.planGenerationJob.update({
          where: { id: job.id },
          data: { leaseOwner: 'new-owner' },
        });
        throw new Error('late failure');
      }),
    };
    const consumer = new PlanGenerationSqsConsumer(planner as any, prisma as any);
    (consumer as any).client = { send: jest.fn().mockResolvedValue({}) };
    await (consumer as any).processMessage({
      Body: JSON.stringify({ generationId: job.id, userId: f.user.id }),
      ReceiptHandle: 'test',
    });
    expect(planner.planFromHealth).toHaveBeenCalledTimes(1);
    expect(
      await prisma.planGenerationJob.findUniqueOrThrow({ where: { id: job.id } }),
    ).toMatchObject({ status: 'PROCESSING', leaseOwner: 'new-owner', attempts: 0 });
  });

  describe('foreground resumption', () => {
    const wednesday = new Date('2026-09-23T15:00:00Z');
    async function resumable() {
      const f = await fixture('scheduled');
      await prisma.user.update({
        where: { id: f.user.id },
        data: { availableDays: ['monday', 'wednesday', 'friday'] },
      });
      return f;
    }

    it('resumes after two weeks without generating the gap, closes pending history and includes current-week runs', async () => {
      const f = await resumable();
      const done = await f.create('2026-09-09', 'partial');
      await contexts.sync(f.user.id, {
        runs: [{ startDate: '2026-09-22T12:00:00Z', distanceMeters: 5000, durationSeconds: 1800 }],
        timeZone: 'America/Sao_Paulo',
        capturedAt: new Date().toISOString(),
      });
      const result = await automation.resume(f.user.id, false, wednesday);
      expect(result).toMatchObject({
        started: true,
        weekStartDate: '2026-09-21',
        generation: { status: 'queued' },
      });
      const job = await prisma.planGenerationJob.findUniqueOrThrow({
        where: { id: result.generation!.generationId },
      });
      expect(job.payload).toMatchObject({
        runs: [expect.objectContaining({ distanceMeters: 5000 })],
        resumeWindow: { minTrainingDate: '2026-09-23', availableDays: ['wednesday', 'friday'] },
      });
      expect(
        (await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: f.week.id } })).closureReason,
      ).toBe('resume');
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.last.id } })).status).toBe(
        'skipped',
      );
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: done.id } })).status).toBe(
        'partial',
      );
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.rest.id } })).status).toBe(
        'scheduled',
      );
      expect(await prisma.weeklyGoal.count({ where: { trainingPlanId: f.plan.id } })).toBe(1);
    });

    it('serializes simultaneous app openings into one generation and one dispatch', async () => {
      const f = await resumable();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => automation.resume(f.user.id, false, wednesday)),
      );
      expect(results.filter((r) => r.started)).toHaveLength(1);
      expect(new Set(results.map((r) => r.generation?.generationId)).size).toBe(1);
      expect(sqs.send).toHaveBeenCalledTimes(1);
    });

    it.each(['GENERATED', 'LOCKED'] as const)(
      'never replaces a %s target week, even without pending workouts',
      async (status) => {
        const f = await resumable();
        await prisma.weeklyGoal.create({
          data: {
            trainingPlanId: f.plan.id,
            weekStartDate: new Date('2026-09-21'),
            weekEndDate: new Date('2026-09-27'),
            status,
            metrics: {},
          },
        });
        expect((await automation.resume(f.user.id, false, wednesday)).generation).toBeNull();
        expect(
          (await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: f.week.id } })).closedAt,
        ).toBeNull();
      },
    );

    it('allows a PLANNED skeleton and preserves corrections in already closed weeks', async () => {
      const f = await resumable();
      await prisma.weeklyGoal.update({
        where: { id: f.week.id },
        data: { closedAt: new Date('2026-09-13'), closureReason: 'sunday' },
      });
      await prisma.weeklyGoal.create({
        data: {
          trainingPlanId: f.plan.id,
          weekStartDate: new Date('2026-09-21'),
          weekEndDate: new Date('2026-09-27'),
          status: 'PLANNED',
          metrics: {},
        },
      });
      expect((await automation.resume(f.user.id, false, wednesday)).started).toBe(true);
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.last.id } })).status).toBe(
        'scheduled',
      );
    });

    it('does not reset a failed job on reopening; explicit retry updates its window', async () => {
      const f = await resumable();
      const first = await automation.resume(f.user.id, false, wednesday);
      const id = first.generation!.generationId;
      await prisma.planGenerationJob.update({
        where: { id },
        data: { status: 'FAILED', attempts: 3 },
      });
      expect((await automation.resume(f.user.id, false, wednesday)).generation?.status).toBe(
        'failed',
      );
      expect(sqs.send).toHaveBeenCalledTimes(1);
      const retry = await automation.resume(f.user.id, true, new Date('2026-09-25T15:00:00Z'));
      expect(retry).toMatchObject({
        started: true,
        generation: { generationId: id, status: 'queued' },
      });
      expect(
        (await prisma.planGenerationJob.findUniqueOrThrow({ where: { id } })).payload,
      ).toMatchObject({
        resumeWindow: { minTrainingDate: '2026-09-25', availableDays: ['friday'] },
      });
      expect(sqs.send).toHaveBeenCalledTimes(2);
    });

    it('passes the partial window to the consumer and terminates an expired window without three retries', async () => {
      const f = await resumable();
      const resumed = await automation.resume(f.user.id, false, wednesday);
      const generationId = resumed.generation!.generationId;
      const planner = {
        planFromHealth: jest.fn(
          async (...args: [string, unknown, string, string, ResumePlanningWindow]) => {
            resumeWindowAtExecution(args[4], new Date('2026-09-28T12:00:00Z'));
          },
        ),
      };
      const consumer = new PlanGenerationSqsConsumer(planner as any, prisma as any);
      (consumer as any).client = { send: jest.fn().mockResolvedValue({}) };
      await (consumer as any).processMessage({
        Body: JSON.stringify({ generationId, userId: f.user.id }),
        ReceiptHandle: 'test',
      });
      expect(planner.planFromHealth).toHaveBeenCalledWith(
        f.user.id,
        expect.any(Object),
        generationId,
        expect.any(String),
        expect.objectContaining({
          minTrainingDate: '2026-09-23',
          availableDays: ['wednesday', 'friday'],
        }),
      );
      expect(
        await prisma.planGenerationJob.findUniqueOrThrow({ where: { id: generationId } }),
      ).toMatchObject({ status: 'FAILED', attempts: 1 });
    });

    it('leaves onboarding, disabled automation, missing snapshots and expired entitlement alone', async () => {
      const f = await resumable();
      billing.isEntitled.mockResolvedValue(false);
      expect((await automation.resume(f.user.id, false, wednesday)).started).toBe(false);
      billing.isEntitled.mockResolvedValue(true);
      config.set('WEEKLY_PLAN_AUTOMATION_ENABLED', 'false');
      expect((await automation.resume(f.user.id, false, wednesday)).started).toBe(false);
      config.set('WEEKLY_PLAN_AUTOMATION_ENABLED', 'true');
      await prisma.plannerHealthContext.delete({ where: { userId: f.user.id } });
      expect((await automation.resume(f.user.id, false, wednesday)).started).toBe(false);
      await prisma.plannerHealthContext.create({
        data: { userId: f.user.id, timeZone: 'UTC', capturedAt: wednesday, payload: { runs: [] } },
      });
      await prisma.weeklyGoal.deleteMany({ where: { trainingPlanId: f.plan.id } });
      expect((await automation.resume(f.user.id, false, wednesday)).started).toBe(false);
      expect(sqs.send).not.toHaveBeenCalled();
    });

    it('rolls back historical changes when reservation fails and keeps a job durable during SQS outage', async () => {
      const f = await resumable();
      const spy = jest.spyOn(jobs, 'reserve').mockRejectedValueOnce(new Error('DB failure'));
      await expect(automation.resume(f.user.id, false, wednesday)).rejects.toThrow('DB failure');
      spy.mockRestore();
      expect((await prisma.workout.findUniqueOrThrow({ where: { id: f.last.id } })).status).toBe(
        'scheduled',
      );
      sqs.send.mockRejectedValueOnce(new Error('SQS unavailable'));
      const result = await automation.resume(f.user.id, false, wednesday);
      expect(result.started).toBe(true);
      await jobs.dispatchPending();
      expect(
        (
          await prisma.planGenerationJob.findUniqueOrThrow({
            where: { id: result.generation!.generationId },
          })
        ).enqueuedAt,
      ).not.toBeNull();
    });

    it('shares locks with Sunday closure without creating a second target job', async () => {
      const f = await resumable();
      const sunday = new Date('2026-09-14T02:00:00Z');
      await Promise.all([
        automation.closeWeek(f.user.id, f.week.id, sunday),
        automation.resume(f.user.id, false, sunday),
      ]);
      expect(await prisma.planGenerationJob.count({ where: { userId: f.user.id } })).toBe(1);
      expect(sqs.send).toHaveBeenCalledTimes(1);
    });
  });

  it('only one SQS consumer executes duplicate messages, reading persisted input', async () => {
    const f = await fixture();
    const job = await jobs.reserve(prisma, f.user.id, new Date('2026-09-14'), {
      runs: [],
      weekStartDate: '2026-09-14',
    });
    let release!: () => void;
    let started!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const planner = {
      planFromHealth: jest.fn(async () => {
        started();
        await blocked;
      }),
    };
    const consumer = new PlanGenerationSqsConsumer(planner as any, prisma as any);
    const queue = { send: jest.fn().mockResolvedValue({}) };
    (consumer as any).client = queue;
    const msg = {
      Body: JSON.stringify({ generationId: job.id, userId: f.user.id, input: { runs: ['stale'] } }),
      ReceiptHandle: 'test',
    };
    const first = (consumer as any).processMessage(msg);
    await entered;
    await (consumer as any).processMessage(msg);
    expect(planner.planFromHealth).toHaveBeenCalledTimes(1);
    expect(planner.planFromHealth).toHaveBeenCalledWith(
      f.user.id,
      { runs: [], weekStartDate: '2026-09-14' },
      job.id,
      expect.any(String),
    );
    release();
    await first;
  });
});
