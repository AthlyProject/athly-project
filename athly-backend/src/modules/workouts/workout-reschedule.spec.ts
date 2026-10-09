import { PrismaService } from '../../database/prisma.service';
import { WorkoutsService } from './workouts.service';

describe('Workout rescheduling', () => {
  const source = {
    id: 'source',
    userId: 'user-1',
    trainingPlanId: 'plan-1',
    weeklyGoalId: 'week-1',
    dateScheduled: new Date('2026-09-30T00:00:00Z'),
    sportType: 'running',
    status: 'scheduled',
    title: 'Easy run',
    blocks: [],
  };
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    workout: { findFirst: jest.fn(), update: jest.fn() },
    weeklyGoal: { findUnique: jest.fn() },
  };
  let service: WorkoutsService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    prisma.workout.findFirst.mockResolvedValueOnce(source).mockResolvedValue(null);
    prisma.weeklyGoal.findUnique.mockResolvedValue({ weekStartDate: new Date('2026-09-28') });
    prisma.workout.update.mockImplementation(({ data }) => ({ ...source, ...data }));
    service = new WorkoutsService(prisma as unknown as PrismaService);
  });

  it.each(['2026-09-28', '2026-09-29', '2026-10-04'])(
    'moves to an empty day in the same week: %s',
    async (date) => {
      const result = await service.updateWorkout('user-1', source.id, { date });
      expect(result.date).toBe(date);
      expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.workout.findFirst.mock.invocationCallOrder[0],
      );
      expect(prisma.workout.findFirst).toHaveBeenLastCalledWith({
        where: {
          userId: 'user-1',
          trainingPlanId: 'plan-1',
          id: { not: source.id },
          sportType: { not: 'other' },
          dateScheduled: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) },
        },
        select: { id: true },
      });
    },
  );

  it('rejects an occupied destination regardless of its workout status', async () => {
    prisma.workout.findFirst.mockResolvedValue({ id: 'occupied' });
    await expect(
      service.updateWorkout('user-1', source.id, { date: '2026-09-28' }),
    ).rejects.toMatchObject({ status: 409, response: { code: 'WORKOUT_DATE_OCCUPIED' } });
    expect(prisma.workout.update).not.toHaveBeenCalled();
  });

  it.each(['done', 'partial', 'skipped'])('rejects moving a %s workout', async (status) => {
    prisma.workout.findFirst.mockReset().mockResolvedValue({ ...source, status });
    await expect(
      service.updateWorkout('user-1', source.id, { date: '2026-09-28' }),
    ).rejects.toMatchObject({ status: 409, response: { code: 'WORKOUT_NOT_RESCHEDULABLE' } });
    expect(prisma.workout.update).not.toHaveBeenCalled();
  });

  it.each(['2026-09-27', '2026-10-05', 'invalid'])(
    'rejects another week or invalid date: %s',
    async (date) => {
      await expect(service.updateWorkout('user-1', source.id, { date })).rejects.toMatchObject({
        status: 400,
      });
      expect(prisma.workout.update).not.toHaveBeenCalled();
    },
  );

  it('allows a metadata edit that keeps the same date on a completed workout', async () => {
    prisma.workout.findFirst.mockReset().mockResolvedValue({ ...source, status: 'done' });
    await service.updateWorkout('user-1', source.id, { date: '2026-09-30', title: 'Updated' });
    expect(prisma.workout.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.workout.update).toHaveBeenCalled();
  });

  it('rejects a workout owned by another user', async () => {
    prisma.workout.findFirst.mockReset().mockResolvedValue(null);
    await expect(
      service.updateWorkout('user-1', source.id, { date: '2026-09-28' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.workout.update).not.toHaveBeenCalled();
  });
});
