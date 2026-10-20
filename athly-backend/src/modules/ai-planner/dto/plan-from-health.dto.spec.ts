import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import {
  validationExceptionFactory,
  ValidationErrorBody,
} from '../../../common/errors/validation-exception.factory';
import { CompleteWorkoutDto } from '../../workouts/dto/complete-workout.dto';
import { PlanFromHealthDto } from './plan-from-health.dto';
import { PlannerHealthContextDto, WorkoutPlanningContextDto } from './planner-health-context.dto';

const run = {
  appleHealthWorkoutUUID: 'health-workout-1',
  startDate: '2026-10-05T10:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1800,
  averagePaceSecondsPerKm: 360,
  activeEnergyBurned: 400,
};
const context = (runs: unknown[]) => ({
  runs,
  timeZone: 'America/Sao_Paulo',
  capturedAt: '2026-10-06T10:00:00.000Z',
});

const contracts: {
  name: string;
  dto: Type<unknown>;
  wrap: (runs: unknown[]) => object;
  fieldPrefix: string;
}[] = [
  {
    name: 'sync/async plan generation',
    dto: PlanFromHealthDto,
    wrap: (runs) => ({ runs }),
    fieldPrefix: 'runs',
  },
  {
    name: 'health synchronization',
    dto: PlannerHealthContextDto,
    wrap: context,
    fieldPrefix: 'runs',
  },
  {
    name: 'workout completion',
    dto: CompleteWorkoutDto,
    wrap: (runs) => ({ planningContext: context(runs) }),
    fieldPrefix: 'planningContext.runs',
  },
  {
    name: 'workout skip',
    dto: WorkoutPlanningContextDto,
    wrap: (runs) => ({ planningContext: context(runs) }),
    fieldPrefix: 'planningContext.runs',
  },
];

describe.each(contracts)('Planner HR contract: $name', ({ dto, wrap, fieldPrefix }) => {
  const validate = (payload: object) =>
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }).transform(payload, { type: 'body', metatype: dto });

  it('accepts and preserves HR for all 20 runs sent by iOS', async () => {
    const runs = Array.from({ length: 20 }, (_, index) => ({
      ...run,
      appleHealthWorkoutUUID: `health-workout-${index}`,
      avgHR: 145.5,
      maxHR: 180,
    }));
    const validated = await validate(wrap(runs));
    const savedRuns = fieldPrefix.startsWith('planningContext')
      ? validated.planningContext.runs
      : validated.runs;
    expect(savedRuns).toHaveLength(20);
    expect(savedRuns).toEqual(runs);
  });

  it.each([{}, { avgHR: null, maxHR: null }, { avgHR: 30, maxHR: 240 }, { avgHR: 155.5 }])(
    'accepts optional fields and valid boundaries: %j',
    async (heartRate) => {
      await expect(validate(wrap([{ ...run, ...heartRate }]))).resolves.toBeDefined();
    },
  );

  it.each(['avgHR', 'maxHR'])(
    'rejects invalid %s without reporting it as unknown',
    async (field) => {
      for (const value of [0, 29.9, 240.1, -1, '150', true]) {
        try {
          await validate(wrap([{ ...run, [field]: value }]));
          throw new Error('Expected validation failure');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          const body = (error as BadRequestException).getResponse() as ValidationErrorBody;
          expect(body.code).toBe('VALIDATION_FAILED');
          expect(body.errors.length).toBeGreaterThan(0);
          expect(body.errors.every((item) => item.field === `${fieldPrefix}.0.${field}`)).toBe(
            true,
          );
          expect(body.errors.some((item) => item.constraint === 'whitelistValidation')).toBe(false);
        }
      }
    },
  );

  it('accepts the workout origin sent by new clients', async () => {
    const origin = {
      endDate: '2026-10-05T10:31:00.000Z',
      sourceBundleIdentifier: 'com.apple.health',
      wasUserEntered: false,
    };
    const validated = await validate(wrap([{ ...run, ...origin }]));
    const savedRuns = fieldPrefix.startsWith('planningContext')
      ? validated.planningContext.runs
      : validated.runs;
    expect(savedRuns[0]).toMatchObject(origin);
    await expect(validate(wrap([{ ...run, wasUserEntered: 'no' }]))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts the time-window read: up to 60 runs and the read start', async () => {
    const runs = Array.from({ length: 60 }, (_, index) => ({
      ...run,
      appleHealthWorkoutUUID: `health-workout-${index}`,
    }));
    const withReadFrom = (payload: any, runsReadFrom: unknown) =>
      fieldPrefix.startsWith('planningContext')
        ? { planningContext: { ...payload.planningContext, runsReadFrom } }
        : { ...payload, runsReadFrom };
    const validated = await validate(withReadFrom(wrap(runs), '2026-08-18T10:00:00.000Z'));
    const saved = fieldPrefix.startsWith('planningContext') ? validated.planningContext : validated;
    expect(saved.runs).toHaveLength(60);
    expect(saved.runsReadFrom).toBe('2026-08-18T10:00:00.000Z');
    await expect(validate(withReadFrom(wrap(runs), 'ontem'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('still rejects unknown fields in runs and at the request root', async () => {
    for (const payload of [
      wrap([{ ...run, unexpectedField: 1 }]),
      { ...wrap([run]), unexpectedField: 1 },
    ]) {
      await expect(validate(payload)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
