import { AiPlannerService } from './ai-planner.service';
import { EffortZoneService } from '../effort-zones/effort-zone.service';
import { SegmentLabel, DetailedSessionDto } from './dto/plan-from-health.dto';
import type { RunDataForZones } from '../effort-zones/types/effort-zone.types';
import { buildMacrocycle } from './periodization';

// bestSubEffortsFromSessions/bestContinuousWindow são matemática pura e não tocam o Prisma —
// o service é construído com stubs. As privadas são exercitadas via cast, como em outros specs.
const planner = new AiPlannerService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
const bestSubEfforts = (sessions: DetailedSessionDto[]): RunDataForZones[] =>
  (planner as any).bestSubEffortsFromSessions(sessions);

const paceOf = (c: RunDataForZones): number => (c.durationSeconds / c.distanceMeters) * 1000;

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
