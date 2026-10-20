import { NotFoundException } from '@nestjs/common';
import { ErrorCode } from '../../common/errors/error-codes';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import type { HealthRunItemDto } from './dto/plan-from-health.dto';
import { GoalAnalysisService } from './goal-analysis.service';

const now = new Date('2026-10-20T12:00:00Z');
const DAY = 86_400_000;

const run = (
  n: number,
  daysAgo: number,
  km: number,
  pace: number,
  origin = true,
): HealthRunItemDto => {
  const start = new Date(now.getTime() - daysAgo * DAY - 2 * 3600_000);
  const seconds = km * pace;
  return {
    appleHealthWorkoutUUID: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + seconds * 1000).toISOString(),
    distanceMeters: km * 1000,
    durationSeconds: seconds,
    ...(origin
      ? { sourceBundleIdentifier: 'com.garmin.connect.mobile', wasUserEntered: false }
      : {}),
  };
};

/** ~25 km/semana em 8 semanas, maior 13 km, 10 km a 5:00/km (VDOT ~40). */
const historico = (origin = true) => {
  const runs: HealthRunItemDto[] = [];
  for (let week = 0; week < 8; week++) {
    for (const [offset, km, pace] of [
      [2, 13, 345],
      [3, 4, 360],
      [5, 10, 300],
      [7, 6, 350],
    ]) {
      runs.push(run(runs.length + 1, offset + 7 * week, km, pace, origin));
    }
  }
  return runs;
};

const meiaSub145 = {
  isRunningRelated: true,
  summary: 'Treinar para meia maratona em 1:45:00',
  targetDistance: 'half',
  targetTime: '1:45:00',
  eventDate: '2026-12-27',
  eventName: null,
  experienceLevel: 'intermediate',
  rejectionReason: null,
};

describe('GoalAnalysisService.analyze', () => {
  const prisma = {
    userGoal: { findFirst: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    plannerHealthContext: { findUnique: jest.fn() },
  };
  const heartRateHealth = { resolve: jest.fn() };
  const service = new GoalAnalysisService(
    prisma as any,
    new EffortZoneService({} as any),
    heartRateHealth as any,
  );
  const body = (runs: HealthRunItemDto[], extra: object = {}) =>
    ({
      runs,
      runsReadFrom: new Date(now.getTime() - 63 * DAY).toISOString(),
      timeZone: 'America/Sao_Paulo',
      ...extra,
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.userGoal.findFirst.mockResolvedValue({ id: 'goal-1', parsedGoal: meiaSub145 });
    prisma.user.findUnique.mockResolvedValue({ fitnessLevel: 'intermediate' });
    prisma.plannerHealthContext.findUnique.mockResolvedValue(null);
  });

  it('analisa a meta ativa, grava a viabilidade e traz alternativas na mesma data', async () => {
    heartRateHealth.resolve.mockResolvedValue({ runs: historico() });
    const result = await service.analyze('user-1', body(historico()), now);
    expect(result.goal).toMatchObject({ targetDistance: 'half', eventDate: '2026-12-27' });
    expect(result.hasHistory).toBe(true);
    expect(result.numbers.enduranceDemonstrated).toBe(false);
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.every((a) => a.goal.eventDate === '2026-12-27')).toBe(true);
    const saved = prisma.userGoal.updateMany.mock.calls[0][0];
    expect(saved.where).toEqual({ id: 'goal-1', active: true });
    expect(saved.data.feasibility).toMatchObject({
      verdict: result.verdict,
      alternatives: result.alternatives,
    });
    // Os campos que os apps publicados exigem continuam lá.
    for (const field of ['currentVdot', 'requiredVdot', 'targetTimeSec', 'weeksAvailable']) {
      expect(saved.data.feasibility[field]).toEqual(expect.any(Number));
    }
  });

  it('meta em rascunho não grava nada e usa o nível do usuário', async () => {
    heartRateHealth.resolve.mockResolvedValue({ runs: historico() });
    const result = await service.analyze(
      'user-1',
      body(historico(), {
        goal: {
          objectiveDistance: '10k',
          objectiveType: 'target_time',
          targetTime: '45:00',
          eventDate: '2026-12-06',
        },
      }),
      now,
    );
    expect(result.goal).toMatchObject({
      summary: 'Treinar para 10K em 45:00',
      eventDate: '2026-12-06',
    });
    expect(result.alternatives.map((a) => a.goal.objectiveDistance)).toEqual(
      expect.arrayContaining(['10k']),
    );
    expect(prisma.userGoal.findFirst).not.toHaveBeenCalled();
    expect(prisma.userGoal.updateMany).not.toHaveBeenCalled();
  });

  it('cliente sem a origem das corridas (antigo ou Android): só a projeção do VDOT', async () => {
    const semOrigem = historico(false);
    heartRateHealth.resolve.mockResolvedValue({ runs: semOrigem });
    prisma.userGoal.findFirst.mockResolvedValue({
      id: 'goal-1',
      parsedGoal: {
        ...meiaSub145,
        targetTime: '1:30:00',
        summary: 'Treinar para meia maratona em 1:30:00',
      },
    });
    const result = await service.analyze(
      'user-1',
      body(semOrigem, { runsReadFrom: undefined }),
      now,
    );
    expect(result.numbers.enduranceDemonstrated).toBeNull();
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0]).toMatchObject({ axis: 'time', source: 'projection' });
    expect(result.alternatives[0].goal).toMatchObject({
      objectiveDistance: 'half',
      eventDate: '2026-12-27',
    });
  });

  it('sem corridas: estimativa preliminar e semana de avaliação, sem alternativas', async () => {
    heartRateHealth.resolve.mockResolvedValue({ runs: [] });
    const result = await service.analyze('user-1', body([]), now);
    expect(result.hasHistory).toBe(false);
    expect(result.lowConfidence).toBe(true);
    expect(result.title).toBe('Vamos conhecer o seu ritmo');
    // A projeção sairia do VDOT padrão, não do atleta.
    expect(result.alternatives).toEqual([]);
  });

  it('meta sem prova datada não se aplica: o app segue direto para o plano', async () => {
    prisma.userGoal.findFirst.mockResolvedValue({
      id: 'goal-1',
      parsedGoal: { ...meiaSub145, eventDate: null },
    });
    heartRateHealth.resolve.mockResolvedValue({ runs: historico() });
    const result = await service.analyze('user-1', body(historico()), now);
    expect(result.applicable).toBe(false);
    expect(result.alternatives).toEqual([]);
  });

  it('recusa rascunho com tempo alvo impossível', async () => {
    heartRateHealth.resolve.mockResolvedValue({ runs: [] });
    await expect(
      service.analyze(
        'user-1',
        body([], {
          goal: { objectiveDistance: '42k', objectiveType: 'target_time', targetTime: '3:30' },
        }),
        now,
      ),
    ).rejects.toMatchObject({ response: { code: ErrorCode.GOAL_TARGET_TIME_INVALID } });
  });

  it('sem meta ativa nem rascunho: 404', async () => {
    prisma.userGoal.findFirst.mockResolvedValue(null);
    heartRateHealth.resolve.mockResolvedValue({ runs: [] });
    const attempt = service.analyze('user-1', body([]), now);
    await expect(attempt).rejects.toBeInstanceOf(NotFoundException);
    await expect(attempt).rejects.toMatchObject({ response: { code: ErrorCode.GOAL_NOT_FOUND } });
  });
});
