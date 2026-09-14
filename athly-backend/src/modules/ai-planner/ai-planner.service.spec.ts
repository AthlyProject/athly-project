import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiPlannerService } from './ai-planner.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { SegmentLabel, DetailedSessionDto } from './dto/plan-from-health.dto';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import { buildMacrocycle } from './periodization';

// bestSubEffortsFromSessions/bestContinuousWindow são matemática pura e não tocam o Prisma —
// o service é construído com stubs. As privadas são exercitadas via cast, como em outros specs.
const mockSqs = { send: jest.fn().mockResolvedValue(undefined) } as any;
const planner = new AiPlannerService(
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  mockSqs,
);
const bestSubEfforts = (sessions: DetailedSessionDto[]): RunDataForZones[] =>
  (planner as any).bestSubEffortsFromSessions(sessions);

const paceOf = (c: RunDataForZones): number => (c.durationSeconds / c.distanceMeters) * 1000;

describe('AiPlannerService.resolvePlanningWindow — primeira semana sem treino retroativo', () => {
  const resolve = (weekStartDate: string | undefined, availableDays: string[], now: string) =>
    (planner as any).resolvePlanningWindow(weekStartDate, availableDays, new Date(now));

  it('mantém a semana atual e permite treino só nos dias disponíveis restantes', () => {
    const window = resolve(
      undefined,
      ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
      '2026-07-16T12:00:00Z',
    );

    expect(window.weekDates[0]).toBe('2026-07-13');
    expect(window.weekDates[6]).toBe('2026-07-19');
    expect(window.availableDays).toEqual(['friday', 'saturday']);
    expect(window.trainingDays).toBe(2);
    expect(window.minTrainingDate).toBe('2026-07-16');
  });

  it('cai para a próxima segunda quando não existe dia disponível restante na semana atual', () => {
    const window = resolve(undefined, ['monday', 'tuesday', 'wednesday'], '2026-07-16T12:00:00Z');

    expect(window.weekDates[0]).toBe('2026-07-20');
    expect(window.weekDates[6]).toBe('2026-07-26');
    expect(window.availableDays).toEqual(['monday', 'tuesday', 'wednesday']);
    expect(window.minTrainingDate).toBeUndefined();
  });

  it('preserva a semana explícita enviada no payload', () => {
    const window = resolve('2026-07-06', ['monday', 'wednesday', 'friday'], '2026-07-16T12:00:00Z');

    expect(window.weekDates[0]).toBe('2026-07-06');
    expect(window.weekDates[6]).toBe('2026-07-12');
    expect(window.availableDays).toEqual(['monday', 'wednesday', 'friday']);
    expect(window.minTrainingDate).toBeUndefined();
  });
});

function seg(
  label: SegmentLabel,
  distanceKm: number,
  durationSeconds: number,
): DetailedSessionDto['segments'][number] {
  return { label, distanceKm, durationSeconds, avgPaceSecondsPerKm: durationSeconds / distanceKm };
}

/** 6×400m a 4:30 (270s/km) com trotes de recuperação de 90s; warmup/cooldown de 1km. */
function intervalSession(splitsSource = 'events'): DetailedSessionDto {
  const segments: DetailedSessionDto['segments'] = [seg(SegmentLabel.warmup, 1.0, 360)];
  for (let i = 0; i < 6; i++) {
    segments.push(seg(SegmentLabel.rep, 0.4, 108)); // 0.4km / 108s = 4:30/km
    segments.push(seg(SegmentLabel.rec, 0.15, 90)); // trote lento de recuperação
  }
  segments.push(seg(SegmentLabel.cooldown, 1.0, 360));
  const distanceMeters = segments.reduce((s, x) => s + x.distanceKm * 1000, 0);
  const durationSeconds = segments.reduce((s, x) => s + x.durationSeconds, 0);
  return {
    startDate: '2026-06-15T08:00:00Z',
    appleHealthWorkoutUUID: 'uuid-interval',
    distanceMeters,
    durationSeconds,
    segments,
    splitsSource,
  };
}

/** Tempo run: warmup 1km, 3km de tempo a 5:00, cooldown 1km. */
function tempoSession(): DetailedSessionDto {
  const segments: DetailedSessionDto['segments'] = [
    seg(SegmentLabel.warmup, 1.0, 360),
    seg(SegmentLabel.tempo, 1.0, 300),
    seg(SegmentLabel.tempo, 1.0, 300),
    seg(SegmentLabel.tempo, 1.0, 300),
    seg(SegmentLabel.cooldown, 1.0, 360),
  ];
  return {
    startDate: '2026-06-16T08:00:00Z',
    appleHealthWorkoutUUID: 'uuid-tempo',
    distanceMeters: 5000,
    durationSeconds: 1620,
    segments,
    splitsSource: 'events',
  };
}

describe('AiPlannerService.bestSubEffortsFromSessions — esforço limpo (sem diluição por recuperação)', () => {
  it('extrai os tiros sub-5’ sem diluir com as recuperações', () => {
    const candidates = bestSubEfforts([intervalSession()]);
    expect(candidates).toHaveLength(1);

    const repCandidate = candidates[0];
    // 6×400m = 2.4km de tiros.
    expect(repCandidate.distanceMeters).toBeCloseTo(2400, 0);
    // Pace do candidato reflete os tiros (4:30 + ~5% de penalização = ~4:43), NÃO o
    // ~5:36 que a janela antiga (com trotes) produzia.
    expect(paceOf(repCandidate)).toBeLessThan(300); // sub-5:00
    expect(paceOf(repCandidate)).toBeGreaterThan(270); // não mais rápido que o tiro cru (penalização)
  });

  it('extrai o bloco de tempo como candidato sustentado', () => {
    const candidates = bestSubEfforts([tempoSession()]);
    expect(candidates).toHaveLength(1);
    expect(paceOf(candidates[0])).toBeCloseTo(300, -1); // ~5:00/km
  });

  it('ignora sessões synthetic (Garmin/Nike só com totais)', () => {
    const candidates = bestSubEfforts([intervalSession('synthetic')]);
    expect(candidates).toHaveLength(0);
  });
});

describe('EffortZoneService — VDOT deixa de ser subestimado com o esforço limpo', () => {
  const zoneService = new EffortZoneService({} as any);
  const session = intervalSession();
  // Totais da sessão inteira (o que o Apple Health entrega): pace ~6:00/km com aquecimento,
  // recuperações e volta à calma na conta.
  const totals: RunDataForZones = {
    distanceMeters: session.distanceMeters,
    durationSeconds: session.durationSeconds,
    averageHeartRate: null,
    maxHeartRate: null,
  };

  it('só com os totais (bug antigo) o VDOT vem baixo e o easy ~7:00/km', () => {
    const zones = zoneService.calculateFromRuns([totals], 'apple_health');
    expect(zones.vdotScore).toBeLessThan(33);
    // easyPaceMin é o EXTREMO RÁPIDO da faixa easy — mesmo ele já passa de 7:00/km.
    expect(zones.easyPaceMin).toBeGreaterThan(410); // > 6:50/km
  });

  it('com o candidato de tiros limpo, o VDOT sobe e o easy fica em ritmo intermediário', () => {
    const candidates = bestSubEfforts([session]);
    const zones = zoneService.calculateFromRuns([totals, ...candidates], 'apple_health');
    expect(zones.vdotScore).toBeGreaterThan(37);
    // Extremo rápido da faixa easy cai para ~6:00/km, coerente com tiros a 4:30 e easy 5:50-6:00.
    expect(zones.easyPaceMin).toBeLessThan(375); // < 6:15/km
  });
});

describe('AiPlannerService.plannedWeekFromMetrics — leitura do contexto do macrociclo', () => {
  const macro = buildMacrocycle({
    startMondayISO: '2026-06-01',
    eventDate: '2026-09-21',
    targetDistanceMeters: 5000,
    currentWeeklyVolumeKm: 30,
    experienceLevel: 'intermediate',
  });
  const fromMetrics = (m: unknown) => (planner as any).plannedWeekFromMetrics(m);

  it('reconstrói uma PlannedWeek persistida em metrics (simula o JSON do Prisma)', () => {
    const week = macro[5];
    const round = fromMetrics(JSON.parse(JSON.stringify(week)));
    expect(round).not.toBeNull();
    expect(round.phase).toBe(week.phase);
    expect(round.weeksToEvent).toBe(week.weeksToEvent);
    expect(round.isRaceWeek).toBe(week.isRaceWeek);
    expect(round.targetVolumeKm).toBe(week.targetVolumeKm);
  });

  it('retorna null para metrics ausente ou de outro formato (ex.: RunAnalysis de uma semana GERADA)', () => {
    expect(fromMetrics(null)).toBeNull();
    expect(fromMetrics({ title: 'Semana de Base', totalDistanceKm: 30 })).toBeNull(); // sem phase
  });
});

describe('AiPlannerService.reserveWeeklyGoal — reserva atômica contra semana duplicada', () => {
  const buildWith = (createImpl: () => Promise<unknown>) =>
    new AiPlannerService(
      { weeklyGoal: { create: createImpl } } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockSqs,
    );
  const reserve = (svc: AiPlannerService) =>
    (svc as any).reserveWeeklyGoal('tp-1', new Date('2026-06-29'), new Date('2026-07-05'));

  it('mapeia violação de unicidade (P2002) para ConflictException', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const svc = buildWith(() => Promise.reject(p2002));
    await expect(reserve(svc)).rejects.toBeInstanceOf(ConflictException);
  });

  it('repassa erros que não são de unicidade', async () => {
    const svc = buildWith(() => Promise.reject(new Error('db down')));
    await expect(reserve(svc)).rejects.toThrow('db down');
  });

  it('retorna o placeholder criado no caminho feliz', async () => {
    const row = { id: 'wg-1' };
    const svc = buildWith(() => Promise.resolve(row));
    await expect(reserve(svc)).resolves.toBe(row);
  });
});

describe('AiPlannerService.startPlanFromHealthGeneration', () => {
  const queuedJob = {
    id: 'generation-1',
    userId: 'user-1',
    weekStartDate: new Date('2026-08-10T00:00:00Z'),
    status: 'QUEUED',
    payload: {},
    result: null,
    weeklyGoalId: null,
    workoutIds: [],
    error: null,
    attempts: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const buildService = (job: any = null) => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ availableDays: ['monday'] }) },
      planGenerationJob: {
        findUnique: jest.fn().mockResolvedValue(job),
        findFirst: jest.fn().mockResolvedValue(job),
        create: jest.fn().mockResolvedValue(queuedJob),
        update: jest.fn().mockResolvedValue(queuedJob),
      },
    };
    const service = new AiPlannerService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockSqs,
    );
    return { service, prisma };
  };

  it('persiste e retorna um job queued antes de iniciar o worker', async () => {
    const { service, prisma } = buildService();
    const started = await service.startPlanFromHealthGeneration('user-1', {
      weekStartDate: '2026-08-10',
    } as any);

    expect(started).toMatchObject({ generationId: 'generation-1', status: 'queued' });
    expect(prisma.planGenerationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });

  it('retorna os ids persistidos somente quando o job está completed', async () => {
    const completed = {
      ...queuedJob,
      status: 'COMPLETED',
      weeklyGoalId: 'week-1',
      workoutIds: ['workout-1'],
    };
    const { service } = buildService(completed);

    await expect(
      service.getPlanFromHealthGenerationStatus('user-1', completed.id),
    ).resolves.toMatchObject({
      status: 'completed',
      weeklyGoalId: 'week-1',
      workoutIds: ['workout-1'],
    });
  });

  it('não expõe status de outro usuário', async () => {
    const { service, prisma } = buildService();
    prisma.planGenerationJob.findFirst.mockResolvedValue(null);
    await expect(
      service.getPlanFromHealthGenerationStatus('user-2', 'generation-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AiPlannerService.assessUndatedGoalAttempt', () => {
  const assess = (sessions: any[]) =>
    (planner as any).assessUndatedGoalAttempt(
      {
        isRunningRelated: true,
        targetDistance: '5k',
        targetTime: '00:25:00',
        eventDate: null,
        eventName: null,
        experienceLevel: 'intermediate',
        summary: 'Correr 5km em menos de 25 minutos',
        rejectionReason: null,
      },
      {
        completedWorkouts: 3,
        totalWorkouts: 3,
        completionRate: 1,
        totalDistanceKm: 12.22,
        avgEffort: 4.7,
        avgFatigue: 4.3,
        skippedWorkouts: [],
        volumeChange: 'manteve',
      },
      sessions,
      undefined,
    );

  const continuous5k = (mainPace: string) => [
    {
      session: {
        distanceMeters: 6980,
        durationSeconds: 2412,
        segments: [
          { label: SegmentLabel.warmup, distanceKm: 1.64, durationSeconds: 601 },
          { label: SegmentLabel.tempo, distanceKm: 5.01, durationSeconds: 1586 },
          { label: SegmentLabel.cooldown, distanceKm: 0.33, durationSeconds: 225 },
        ],
      },
      executionAnalysis: { mainPace },
    },
  ];

  it('bloqueia tentativa quando o 5k recente está fora da margem de 3%', () => {
    const verdict = assess(continuous5k('5:17'));
    expect(verdict.feasible).toBe(false);
    expect(verdict.targetPace).toBe('5:00/km');
    expect(verdict.recentPace).toBe('5:17/km');
  });

  it('não usa tiros curtos como prova de sustentação do 5k', () => {
    const verdict = assess([
      {
        session: {
          distanceMeters: 3950,
          durationSeconds: 1380,
          segments: [
            { label: SegmentLabel.warmup, distanceKm: 1.68, durationSeconds: 600 },
            { label: SegmentLabel.rep, distanceKm: 0.4, durationSeconds: 108 },
            { label: SegmentLabel.rec, distanceKm: 0.33, durationSeconds: 120 },
            { label: SegmentLabel.rep, distanceKm: 0.41, durationSeconds: 108 },
          ],
        },
        executionAnalysis: { mainPace: '4:27', meanRepPace: '4:27' },
      },
    ]);

    expect(verdict.feasible).toBe(false);
    expect(verdict.recentPace).toBeUndefined();
  });

  it('permite tentativa quando há esforço contínuo similar dentro de 3%', () => {
    const verdict = assess(continuous5k('5:07'));
    expect(verdict.feasible).toBe(true);
  });
});
