import type { HealthRunItemDto } from './dto/plan-from-health.dto';
import { assessGoalFeasibility } from './goal-feasibility';
import {
  RACE_DISTANCES,
  analysisText,
  formatGoalTime,
  projectionAlternative,
  raceAlternatives,
} from './goal-analysis';
import { healthObjectiveEvidence, summarizeAssessment, assessDatedGoal } from './objective-goal';

const asOf = new Date('2026-10-20T12:00:00Z');
const DAY = 86_400_000;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Corrida registrada por relógio: `daysAgo` dias atrás, `km` a `pace` s/km. */
const run = (n: number, daysAgo: number, km: number, pace: number): HealthRunItemDto => {
  const start = new Date(asOf.getTime() - daysAgo * DAY - 2 * 3600_000);
  const seconds = km * pace;
  return {
    appleHealthWorkoutUUID: uuid(n),
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + seconds * 1000).toISOString(),
    distanceMeters: km * 1000,
    durationSeconds: seconds,
    sourceBundleIdentifier: 'com.garmin.connect.mobile',
    wasUserEntered: false,
  };
};

/** 4 corridas por semana em 8 semanas: ~25 km/semana, maior 13 km, um 10 km a 5:00/km por semana. */
const intermediario = (): HealthRunItemDto[] => {
  const runs: HealthRunItemDto[] = [];
  for (let week = 0; week < 8; week++) {
    for (const [offset, km, pace] of [
      [2, 13, 345],
      [3, 4, 360],
      [5, 10, 300],
      [7, 6, 350],
    ]) {
      runs.push(run(runs.length + 1, offset + 7 * week, km, pace));
    }
  }
  return runs;
};

const evidenceOf = (runs: HealthRunItemDto[], capturedAt: Date = asOf) =>
  healthObjectiveEvidence({
    userId: 'u1',
    runs,
    asOf,
    timeZone: 'America/Sao_Paulo',
    readLimit: 20,
    readFrom: new Date(capturedAt.getTime() - 63 * DAY),
    capturedAt,
  })!;

const target = (distanceMeters: number, timeSeconds: number | null, eventDate: string) => ({
  modality: 'running',
  distanceMeters,
  timeSeconds,
  eventDate,
  timeZone: 'America/Sao_Paulo',
});

describe('raceAlternatives', () => {
  it('propõe uma prova menor com o tempo equivalente, na mesma data', () => {
    // Meia em 1:45 a 10 semanas: falta volume (25 contra 31,6 km/semana).
    const alternatives = raceAlternatives(
      target(21097.5, 6300, '2026-12-27'),
      evidenceOf(intermediario()),
    );
    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.length).toBeLessThanOrEqual(3);
    const keys = RACE_DISTANCES.map((d) => d.key) as string[];
    for (const alternative of alternatives) {
      expect(alternative.source).toBe('objective');
      expect(alternative.goal.eventDate).toBe('2026-12-27');
      expect(keys).toContain(alternative.goal.objectiveDistance);
    }
    const both = alternatives.find((a) => a.axis === 'both')!;
    expect(both.goal).toMatchObject({ objectiveDistance: '15k', objectiveType: 'target_time' });
    expect(both.goal.targetTime).toMatch(/^1:\d{2}:[03]0$/);
    expect(both.summary).toBe(`15K em ${both.goal.targetTime} no mesmo dia`);
    // A mesma prova com o tempo da meta original não aparece de novo.
    expect(alternatives.filter((a) => a.goal.objectiveDistance === '15k')).toHaveLength(1);
  });

  it('meta sem tempo alvo só ganha a prova menor, para completar', () => {
    const alternatives = raceAlternatives(
      target(21097.5, null, '2026-12-27'),
      evidenceOf(intermediario()),
    );
    expect(alternatives).toEqual([
      expect.objectContaining({
        axis: 'distance',
        summary: 'Completar 15K no mesmo dia',
        goal: { objectiveDistance: '15k', objectiveType: 'workload', eventDate: '2026-12-27' },
      }),
    ]);
  });

  it('nada quando a meta já está confirmada', () => {
    expect(
      raceAlternatives(target(10000, 3300, '2026-12-27'), evidenceOf(intermediario())),
    ).toEqual([]);
  });

  it('nada para prova a mais de um ano ou com o Health desatualizado', () => {
    expect(
      raceAlternatives(target(21097.5, 6300, '2027-11-21'), evidenceOf(intermediario())),
    ).toEqual([]);
    const stale = evidenceOf(intermediario(), new Date(asOf.getTime() - 10 * DAY));
    expect(raceAlternatives(target(21097.5, 6300, '2026-12-27'), stale)).toEqual([]);
  });
});

describe('projectionAlternative', () => {
  const v1 = (targetTime: string, currentVdot: number) =>
    assessGoalFeasibility({
      goal: { targetDistance: 'half', targetTime, eventDate: '2026-12-27', experienceLevel: null },
      currentVdot,
      asOfISO: '2026-10-19',
    });

  it('oferece o tempo projetado para a mesma data, arredondado em 30 s', () => {
    const feasibility = v1('1:30:00', 33)!;
    expect(feasibility.verdict).toBe('unrealistic');
    const alternative = projectionAlternative(feasibility, {
      targetDistance: 'half',
      eventDate: '2026-12-27',
    })!;
    expect(alternative).toMatchObject({ axis: 'time', source: 'projection' });
    expect(alternative.goal).toMatchObject({
      objectiveDistance: 'half',
      objectiveType: 'target_time',
      eventDate: '2026-12-27',
    });
    const [h, m, s] = alternative.goal.targetTime!.split(':').map(Number);
    const seconds = h * 3600 + m * 60 + s;
    expect(seconds % 30).toBe(0);
    expect(seconds).toBeGreaterThanOrEqual(feasibility.suggestion.realisticTimeSec!);
  });

  it('nada para meta pronta ou viável', () => {
    expect(
      projectionAlternative(v1('2:30:00', 40), { targetDistance: 'half', eventDate: '2026-12-27' }),
    ).toBeNull();
  });
});

describe('analysisText', () => {
  const goal = { targetDistance: 'half', targetTime: '2:00:00', eventDate: '2026-12-27' };

  it('sem corridas, explica a semana de avaliação', () => {
    expect(
      analysisText({ goal, hasHistory: false, feasibility: null, readiness: null }).title,
    ).toBe('Vamos conhecer o seu ritmo');
  });

  it('cita a projeção, a resistência que falta e a estimativa preliminar', () => {
    const feasibility = assessGoalFeasibility({
      goal: { ...goal, experienceLevel: null },
      currentVdot: 30,
      asOfISO: '2026-10-19',
      lowConfidence: true,
    })!;
    const readiness = summarizeAssessment(
      assessDatedGoal({
        distanceMeters: 21097.5,
        timeSeconds: 7200,
        eventDate: '2026-12-27',
        evidence: evidenceOf(intermediario()),
      })!,
    );
    const { title, message } = analysisText({ goal, hasHistory: true, feasibility, readiness });
    expect(title).toBe('Meta difícil para esta data');
    expect(message).toContain(
      `a projeção é ${formatGoalTime(feasibility.suggestion.realisticTimeSec!)}`,
    );
    expect(message).toContain('Ainda não vimos resistência para meia maratona');
    expect(message).toContain('a referência é 15,8 km');
    expect(message).toContain('estimativa preliminar');
  });
});

describe('formatGoalTime', () => {
  it('usa H:MM:SS a partir de 1 hora e MM:SS abaixo', () => {
    expect(formatGoalTime(7230)).toBe('2:00:30');
    expect(formatGoalTime(1650)).toBe('27:30');
  });
});
