import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkoutStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WorkoutsService } from './workouts.service';

describe('WorkoutsService', () => {
  let service: WorkoutsService;
  let prisma: {
    workout: {
      updateMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    workoutFeedback: {
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const workout = {
    id: 'workout-1',
    dateScheduled: new Date('2026-05-12T10:00:00.000Z'),
    sportType: 'running',
    title: 'Intervalos',
    description: null,
    blocks: [],
    status: WorkoutStatus.done,
    intensity: 7,
    stravaActivityId: null,
    appleHealthWorkoutUUID: null,
    actualDistanceMeters: null,
    actualDurationSeconds: null,
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    prisma = {
      workout: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      workoutFeedback: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // O service roda tudo numa transação; aqui o callback recebe o próprio mock.
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    service = new WorkoutsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('completeWorkout', () => {
    it('marks a workout as done without requiring a linked HealthKit workout', async () => {
      prisma.workout.updateMany.mockResolvedValue({ count: 1 });
      prisma.workout.findFirst.mockResolvedValue(workout);

      const result = await service.completeWorkout('user-1', 'workout-1');

      expect(prisma.workout.updateMany).toHaveBeenCalledWith({
        where: { id: 'workout-1', userId: 'user-1' },
        data: { status: 'done' },
      });
      expect(prisma.workout.findFirst).toHaveBeenCalledWith({
        where: { id: 'workout-1', userId: 'user-1' },
        select: expect.objectContaining({
          actualDistanceMeters: true,
          actualDurationSeconds: true,
          isGoalAttempt: true,
          appleHealthWorkoutUUID: true,
        }),
      });
      expect(result).toMatchObject({
        id: 'workout-1',
        date: '2026-05-12',
        status: WorkoutStatus.done,
        isGoalAttempt: false,
        appleHealthWorkoutUUID: null,
        actualDistanceMeters: null,
        actualDurationSeconds: null,
      });
    });

    it('persists HealthKit metadata when a run is selected', async () => {
      prisma.workout.updateMany.mockResolvedValue({ count: 1 });
      prisma.workout.findFirst.mockResolvedValue(workout);

      await service.completeWorkout('user-1', 'workout-1', {
        appleHealthWorkoutUUID: 'hk-uuid',
        actualDistanceMeters: 1000,
        actualDurationSeconds: 300,
      });

      expect(prisma.workout.updateMany).toHaveBeenCalledWith({
        where: { id: 'workout-1', userId: 'user-1' },
        data: {
          status: 'done',
          appleHealthWorkoutUUID: 'hk-uuid',
          actualDistanceMeters: 1000,
          actualDurationSeconds: 300,
        },
      });
    });

    it('persists actual run metrics without requiring a HealthKit UUID', async () => {
      prisma.workout.updateMany.mockResolvedValue({ count: 1 });
      prisma.workout.findFirst.mockResolvedValue({
        ...workout,
        actualDistanceMeters: 5000,
        actualDurationSeconds: 1800,
      });

      const result = await service.completeWorkout('user-1', 'workout-1', {
        actualDistanceMeters: 5000,
        actualDurationSeconds: 1800,
      });

      expect(prisma.workout.updateMany).toHaveBeenCalledWith({
        where: { id: 'workout-1', userId: 'user-1' },
        data: {
          status: 'done',
          actualDistanceMeters: 5000,
          actualDurationSeconds: 1800,
        },
      });
      expect(result).toMatchObject({
        actualDistanceMeters: 5000,
        actualDurationSeconds: 1800,
        appleHealthWorkoutUUID: null,
      });
    });

    it('throws not found when no user-owned workout is updated', async () => {
      prisma.workout.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeWorkout('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not expose raw Prisma errors to clients', async () => {
      prisma.workout.updateMany.mockRejectedValue(
        new Error('The column `(not available)` does not exist'),
      );

      try {
        await service.completeWorkout('user-1', 'workout-1');
        fail('Expected completeWorkout to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error).toMatchObject({
          response: expect.objectContaining({
            message: 'Falha ao completar treino. Tente novamente mais tarde.',
          }),
        });
      }
    });

    it('maps the unique HealthKit UUID clash to a 409 instead of a generic 500', async () => {
      prisma.workout.updateMany.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.completeWorkout('user-1', 'workout-1', { appleHealthWorkoutUUID: 'hk-uuid' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('uncompleteWorkout', () => {
    it('clears the linked run, the actuals and the feedback, back to scheduled', async () => {
      prisma.workout.findFirst.mockResolvedValue({ id: 'workout-1' });
      prisma.workout.update.mockResolvedValue({
        ...workout,
        status: WorkoutStatus.scheduled,
      });

      const result = await service.uncompleteWorkout('user-1', 'workout-1');

      expect(prisma.workoutFeedback.deleteMany).toHaveBeenCalledWith({
        where: { workoutId: 'workout-1', userId: 'user-1' },
      });
      expect(prisma.workout.update).toHaveBeenCalledWith({
        where: { id: 'workout-1' },
        data: {
          status: 'scheduled',
          appleHealthWorkoutUUID: null,
          actualDistanceMeters: null,
          actualDurationSeconds: null,
          executionDetails: Prisma.DbNull,
        },
        select: expect.objectContaining({ appleHealthWorkoutUUID: true }),
      });
      expect(result).toMatchObject({
        id: 'workout-1',
        status: WorkoutStatus.scheduled,
        appleHealthWorkoutUUID: null,
        actualDistanceMeters: null,
        actualDurationSeconds: null,
      });
    });

    it('throws not found for a workout owned by another user', async () => {
      prisma.workout.findFirst.mockResolvedValue(null);

      await expect(service.uncompleteWorkout('user-1', 'workout-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.workout.update).not.toHaveBeenCalled();
      expect(prisma.workoutFeedback.deleteMany).not.toHaveBeenCalled();
    });

    it('does not expose raw Prisma errors to clients', async () => {
      prisma.workout.findFirst.mockResolvedValue({ id: 'workout-1' });
      prisma.workout.update.mockRejectedValue(new Error('connection reset'));

      try {
        await service.uncompleteWorkout('user-1', 'workout-1');
        fail('Expected uncompleteWorkout to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error).toMatchObject({
          response: expect.objectContaining({
            message: 'Falha ao desvincular a corrida. Tente novamente mais tarde.',
          }),
        });
      }
    });
  });
});
