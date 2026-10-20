import { ConflictException } from '@nestjs/common';
import { ErrorCode } from '../../common/errors/error-codes';
import type { PrismaService } from '../../database/prisma.service';
import { GoalsService } from './goals.service';

describe('GoalsService.replaceActiveGoal', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const createdGoal = {
    id: 'goal-2',
    rawText: 'Treinar para 10K em 55:00',
    parsedGoal: {},
    feasibility: null,
    active: true,
    createdAt: now,
  };
  const tx = {
    $queryRaw: jest.fn(),
    planGenerationJob: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    userGoal: { updateMany: jest.fn(), create: jest.fn() },
    weeklyGoal: { deleteMany: jest.fn() },
    trainingPlan: { findUnique: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  let service: GoalsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    tx.planGenerationJob.findFirst.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue({ fitnessLevel: 'hobby' });
    tx.userGoal.create.mockResolvedValue(createdGoal);
    tx.trainingPlan.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    service = new GoalsService(prisma as unknown as PrismaService);
  });
  afterEach(() => jest.useRealTimers());

  const savedGoal = () => tx.userGoal.create.mock.calls[0][0].data.parsedGoal;

  it('troca a meta ativa e devolve no formato do GET /goals/active', async () => {
    const result = await service.replaceActiveGoal('user-1', {
      objectiveDistance: '10k',
      objectiveType: 'target_time',
      targetTime: '55:00',
      eventDate: '2026-12-06',
    });
    expect(tx.userGoal.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', active: true },
      data: { active: false },
    });
    expect(savedGoal()).toMatchObject({
      targetDistance: '10k',
      targetTime: '55:00',
      eventDate: '2026-12-06',
      experienceLevel: 'intermediate',
      summary: 'Treinar para 10K em 55:00',
    });
    expect(result).toEqual(createdGoal);
  });

  it('apaga só o esqueleto da meta antiga e religa o plano à meta nova', async () => {
    await service.replaceActiveGoal('user-1', {
      objectiveDistance: 'half',
      objectiveType: 'workload',
      eventDate: '2026-12-06',
    });
    // Semanas entregues (GENERATED/LOCKED) e a reserva de uma geração (métricas vazias) ficam.
    expect(tx.weeklyGoal.deleteMany).toHaveBeenCalledWith({
      where: {
        trainingPlan: { userId: 'user-1' },
        status: 'PLANNED',
        workouts: { none: {} },
        NOT: { metrics: { equals: {} } },
      },
    });
    expect(tx.trainingPlan.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: { in: ['ACTIVE', 'DRAFT'] } },
      data: {
        userGoalId: 'goal-2',
        objective: 'Treinar para meia maratona',
        targetDate: new Date('2026-12-06'),
      },
    });
  });

  it('limpa a data do plano quando a meta nova não tem prova', async () => {
    await service.replaceActiveGoal('user-1', {
      objectiveDistance: '15k',
      objectiveType: 'workload',
    });
    expect(savedGoal()).toMatchObject({ targetDistance: '15k', eventDate: null });
    expect(tx.trainingPlan.updateMany.mock.calls[0][0].data.targetDate).toBeNull();
  });

  it('recusa a troca com uma geração em andamento, sem mexer na meta', async () => {
    tx.planGenerationJob.findFirst.mockResolvedValue({ id: 'job-1' });
    const attempt = service.replaceActiveGoal('user-1', {
      objectiveDistance: '5k',
      objectiveType: 'workload',
    });
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: ErrorCode.GOAL_CHANGE_GENERATION_IN_PROGRESS },
    });
    expect(tx.userGoal.create).not.toHaveBeenCalled();
    expect(tx.weeklyGoal.deleteMany).not.toHaveBeenCalled();
  });

  it('recusa a troca num plano travado', async () => {
    tx.trainingPlan.findUnique.mockResolvedValue({ status: 'LOCKED' });
    await expect(
      service.replaceActiveGoal('user-1', { objectiveDistance: '5k', objectiveType: 'workload' }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.TRAINING_PLAN_LOCKED } });
    expect(tx.userGoal.create).not.toHaveBeenCalled();
  });

  it.each([
    ['sem tempo', undefined],
    ['com pace impossível', '3:30'],
  ])('recusa tempo alvo %s', async (_label, targetTime) => {
    await expect(
      service.replaceActiveGoal('user-1', {
        objectiveDistance: '42k',
        objectiveType: 'target_time',
        targetTime,
      }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.GOAL_TARGET_TIME_INVALID } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa data de prova no passado antes de abrir a transação', async () => {
    await expect(
      service.replaceActiveGoal('user-1', {
        objectiveDistance: '5k',
        objectiveType: 'workload',
        eventDate: '2026-10-01',
      }),
    ).rejects.toMatchObject({ response: { code: ErrorCode.ASSESSMENT_EVENT_DATE_INVALID } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
