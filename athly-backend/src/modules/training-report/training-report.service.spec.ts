import { Prisma } from '@prisma/client';
import { TrainingReportService } from './training-report.service';

function wk(over: Record<string, any> = {}) {
  return {
    title: 'Treino',
    dateScheduled: new Date('2026-06-01T00:00:00Z'),
    status: 'done',
    sportType: 'running',
    actualDistanceMeters: 5000,
    blocks: [],
    feedback: [{ effort: 6, fatigue: 4 }],
    ...over,
  };
}

const goalsNewestFirst = [
  {
    createdAt: new Date('2026-06-01T00:00:00Z'),
    metrics: {
      avgPace: '5:30',
      fitnessInsights: 'Boa progressão de base.',
      trend: 'improving (volume)',
    },
    workouts: [wk(), wk(), wk()],
  },
  {
    createdAt: new Date('2026-05-25T00:00:00Z'),
    metrics: { avgPace: '5:40' },
    workouts: [wk(), wk()],
  },
];

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    weeklyGoal: { findMany: jest.fn().mockResolvedValue(goalsNewestFirst) },
    trainingPlan: {
      findUnique: jest.fn().mockResolvedValue({
        objective: '5km sub 25min',
        targetDate: new Date('2026-08-20T00:00:00Z'),
        userGoalId: 'goal-1',
      }),
    },
    userGoal: { findUnique: jest.fn().mockResolvedValue({ feasibility: { verdict: 'feasible' } }) },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue({ lastTrainingReport: null }),
    },
    ...overrides,
  };
}

describe('TrainingReportService.captureFromPlan', () => {
  it('monta o laudo das últimas semanas e persiste no usuário', async () => {
    const prisma = makePrisma();
    const service = new TrainingReportService(prisma as any);

    await service.captureFromPlan('user-1', 'plan-1');

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const data = prisma.user.update.mock.calls[0][0].data;
    const report = data.lastTrainingReport;
    expect(report.sourcePlanId).toBe('plan-1');
    expect(report.objective).toBe('5km sub 25min');
    expect(report.targetDate).toBe('2026-08-20');
    expect(report.longitudinalWeeks).toHaveLength(2);
    expect(report.previousWeekAnalysis).not.toBeNull();
    expect(report.previousWeekAnalysis.completedWorkouts).toBe(3);
    expect(report.finalInsights.fitnessInsights).toBe('Boa progressão de base.');
    expect(report.feasibility.verdict).toBe('feasible');
    expect(data.lastTrainingReportAt).toBeInstanceOf(Date);
  });

  it('é no-op quando o plano não tem semanas', async () => {
    const prisma = makePrisma({ weeklyGoal: { findMany: jest.fn().mockResolvedValue([]) } });
    const service = new TrainingReportService(prisma as any);

    await service.captureFromPlan('user-1', 'plan-1');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('lida com plano sem userGoal vinculado (feasibility null)', async () => {
    const prisma = makePrisma({
      trainingPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ objective: 'Correr 10km', targetDate: null, userGoalId: null }),
      },
    });
    const service = new TrainingReportService(prisma as any);

    await service.captureFromPlan('user-1', 'plan-1');

    const report = prisma.user.update.mock.calls[0][0].data.lastTrainingReport;
    expect(report.feasibility).toBeNull();
    expect(report.targetDate).toBeNull();
    expect(prisma.userGoal.findUnique).not.toHaveBeenCalled();
  });
});

describe('TrainingReportService.getForUser / clearForUser', () => {
  it('getForUser retorna o laudo armazenado (sem limpar)', async () => {
    const stored = { sourcePlanId: 'plan-1', objective: 'x' };
    const prisma = makePrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue({ lastTrainingReport: stored }),
        update: jest.fn(),
      },
    });
    const service = new TrainingReportService(prisma as any);

    const report = await service.getForUser('user-1');
    expect(report).toEqual(stored);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('getForUser retorna null sem laudo', async () => {
    const prisma = makePrisma();
    const service = new TrainingReportService(prisma as any);
    expect(await service.getForUser('user-1')).toBeNull();
  });

  it('clearForUser zera o laudo com Prisma.JsonNull', async () => {
    const prisma = makePrisma();
    const service = new TrainingReportService(prisma as any);

    await service.clearForUser('user-1');

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.lastTrainingReport).toBe(Prisma.JsonNull);
    expect(data.lastTrainingReportAt).toBeNull();
  });
});
