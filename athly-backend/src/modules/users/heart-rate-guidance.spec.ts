import { calculateHeartRateZones } from './heart-rate-zones';
import { mergeHeartRateRuns, weightedHeartRate, withTrainingGuidance } from './heart-rate-guidance';
import { HeartRateHealthService } from './heart-rate-health.service';
import { PlannerHealthContextService } from '../ai-planner/planner-health-context.service';

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const run = (extra = {}) => ({
  appleHealthWorkoutUUID: 'ABC',
  startDate: daysAgo(1),
  distanceMeters: 5000,
  durationSeconds: 1800,
  ...extra,
});
const zones = () => calculateHeartRateZones({ restingHeartRate: 60, maxHeartRate: 190 });

describe('Shared HR eligibility and measured run history', () => {
  it('keeps phone-only runners in RPE even with manual HR overrides', () => {
    expect(withTrainingGuidance(zones(), [run()]).trainingGuidance).toEqual({
      mode: 'rpe',
      reason: 'no_recent_heart_rate',
      lastHeartRateRunAt: null,
    });
  });

  it('enables the same profile ranges with a recent measured average', () => {
    const result = withTrainingGuidance(zones(), [run({ avgHR: 146 })]);
    expect(result.trainingGuidance.mode).toBe('heart_rate_and_rpe');
    expect(result.zones[1]).toEqual({ zone: 2, minBpm: 138, maxBpm: 150 });
  });

  it.each([0, NaN, Infinity, 260, undefined])('ignores invalid or missing average %s', (avgHR) => {
    expect(withTrainingGuidance(zones(), [run({ avgHR, maxHR: 170 })]).trainingGuidance.mode).toBe(
      'rpe',
    );
  });

  it('does not activate HR for stale or future measurements', () => {
    for (const startDate of [daysAgo(31), daysAgo(-1)]) {
      expect(
        withTrainingGuidance(zones(), [run({ startDate, avgHR: 145 })]).trainingGuidance.mode,
      ).toBe('rpe');
    }
  });

  it('retains the last measured date for diagnostics even when it is stale', () => {
    const startDate = daysAgo(31);
    const result = withTrainingGuidance(zones(), [run({ startDate, avgHR: 145 })]);
    expect(result.trainingGuidance).toEqual({
      mode: 'rpe',
      reason: 'no_recent_heart_rate',
      lastHeartRateRunAt: startDate,
    });
  });

  it('does not require a distance measurement to recognize HR on a recorded run', () => {
    const runs = mergeHeartRateRuns([run({ distanceMeters: 0, avgHR: 145 })]);
    expect(withTrainingGuidance(zones(), runs).trainingGuidance.mode).toBe('heart_rate_and_rpe');
  });

  it('requires usable resting HR even with recent measured runs and estimated max', () => {
    const inputs = {
      dateOfBirth: new Date('1990-01-01'),
      appleHealthRestingHeartRate: 60,
      appleHealthRestingHeartRateMeasuredAt: new Date(daysAgo(31)),
    };
    expect(
      withTrainingGuidance(calculateHeartRateZones(inputs), [run({ avgHR: 145 })]).trainingGuidance
        .reason,
    ).toBe('missing_zone_inputs');
  });

  it('deduplicates UUID case and timestamp aliases and weights whole runs by duration', () => {
    const startDate = daysAgo(1);
    const merged = mergeHeartRateRuns(
      [run({ startDate, avgHR: 140 })],
      [run({ startDate, appleHealthWorkoutUUID: 'abc', avgHR: 140 })],
      [run({ startDate, appleHealthWorkoutUUID: undefined, segments: [{ avgHR: 220 }] })],
      [
        run({
          startDate: daysAgo(2),
          appleHealthWorkoutUUID: 'second',
          durationSeconds: 600,
          avgHR: 180,
        }),
      ],
    );
    expect(merged).toHaveLength(2);
    expect(weightedHeartRate(merged)).toBe(150);
  });

  it('resolves stored details, snapshot summaries and incoming generation data for the authenticated user', async () => {
    const recordedRun = run({ avgHR: 145 });
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ restingHeartRate: 60, maxHeartRate: 190 }),
      },
      plannerHealthContext: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ payload: { runs: [{ ...recordedRun, avgHR: undefined }] } }),
      },
      workout: {
        findMany: jest.fn().mockResolvedValue([{ executionDetails: recordedRun }]),
      },
    };
    const service = new HeartRateHealthService(prisma as any);
    const profile = await service.zones('runner');
    const generation = await service.resolve('runner', {
      runs: [{ ...recordedRun, avgHR: undefined }],
    });
    expect(generation.zones).toEqual(profile);
    expect(generation.runs).toHaveLength(1);
    expect(profile.trainingGuidance.mode).toBe('heart_rate_and_rpe');
    expect(prisma.workout.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'runner' }) }),
    );
    expect(prisma.plannerHealthContext.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'runner' } }),
    );
  });

  it('preserves measured averages when a later sync cannot read HR and ignores empty replacements', async () => {
    const original = run({ avgHR: 145 });
    const prisma = {
      plannerHealthContext: {
        findUnique: jest.fn().mockResolvedValue({ payload: { runs: [original] } }),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const service = new PlannerHealthContextService(prisma as any);
    const input = {
      runs: [{ ...original, avgHR: undefined }],
      timeZone: 'UTC',
      capturedAt: daysAgo(0),
    };
    await service.sync('runner', input);
    expect(prisma.plannerHealthContext.updateMany.mock.calls[0][0].data.payload.runs[0].avgHR).toBe(
      145,
    );
    expect(prisma.plannerHealthContext.updateMany.mock.calls[0][0].where.capturedAt).toEqual({
      lte: new Date(input.capturedAt),
    });
    await service.sync('runner', { ...input, runs: [] });
    expect(prisma.plannerHealthContext.updateMany).toHaveBeenCalledTimes(1);
  });
});
