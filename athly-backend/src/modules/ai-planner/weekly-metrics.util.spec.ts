import {
  adherenceEligibleWorkouts,
  executedVolumeKm,
  computeLongitudinalWeeks,
  computePreviousWeekAnalysis,
  type WorkoutLike,
} from './weekly-metrics.util';

function wk(over: Partial<WorkoutLike> = {}): WorkoutLike {
  return {
    title: 'Treino',
    dateScheduled: new Date('2026-06-01T00:00:00Z'),
    status: 'done',
    sportType: 'running',
    actualDistanceMeters: 5000,
    blocks: [],
    feedback: [],
    ...over,
  };
}

const previousGoal = {
  createdAt: new Date('2026-06-01T00:00:00Z'),
  metrics: { avgPace: '5:30' },
  workouts: [
    wk({ status: 'done', actualDistanceMeters: 5000, feedback: [{ effort: 6, fatigue: 4 }] }),
    wk({ status: 'done', actualDistanceMeters: 5000, feedback: [{ effort: 6, fatigue: 4 }] }),
    wk({ status: 'done', actualDistanceMeters: 5000, feedback: [{ effort: 6, fatigue: 4 }] }),
    wk({ status: 'skipped', title: 'Tiros', actualDistanceMeters: null, feedback: [] }),
    wk({ status: 'scheduled', sportType: 'other', actualDistanceMeters: null, feedback: [] }),
  ],
};

const baselineGoal = {
  createdAt: new Date('2026-05-25T00:00:00Z'),
  metrics: {},
  workouts: [
    wk({ status: 'done', actualDistanceMeters: 5000, feedback: [] }),
    wk({ status: 'done', actualDistanceMeters: 5000, feedback: [] }),
  ],
};

describe('executedVolumeKm', () => {
  it('prefere actuals, cai para blocks.distance, ignora não-done', () => {
    const workouts = [
      wk({ status: 'done', actualDistanceMeters: 4200, blocks: [] }),
      wk({ status: 'done', actualDistanceMeters: null, blocks: [{ distance: 3 }] }),
      wk({ status: 'skipped', actualDistanceMeters: 9999, blocks: [] }),
    ];
    expect(executedVolumeKm(workouts)).toBeCloseTo(7.2, 5); // 4.2 + 3.0
  });
});

describe('adherenceEligibleWorkouts', () => {
  it('exclui sportType "other" e dias passados não-cumpridos antes da geração', () => {
    const created = new Date('2026-06-10T00:00:00Z');
    const workouts = [
      wk({ status: 'done', dateScheduled: new Date('2026-06-05T00:00:00Z') }), // done no passado conta
      wk({ status: 'scheduled', dateScheduled: new Date('2026-06-12T00:00:00Z') }), // futuro conta
      wk({ status: 'scheduled', dateScheduled: new Date('2026-06-05T00:00:00Z') }), // passado não-cumprido NÃO conta
      wk({ status: 'done', sportType: 'other', dateScheduled: created }), // other nunca conta
    ];
    const eligible = adherenceEligibleWorkouts(workouts, created);
    expect(eligible).toHaveLength(2);
  });
});

describe('computeLongitudinalWeeks', () => {
  it('retorna oldest-first com labels W-n decrescentes', () => {
    const weeks = computeLongitudinalWeeks([previousGoal, baselineGoal]); // newest-first na entrada
    expect(weeks).toHaveLength(2);
    expect(weeks[0].weekLabel).toBe('W-2'); // baseline (mais antiga) primeiro
    expect(weeks[1].weekLabel).toBe('W-1'); // previous (mais recente) por último
    expect(weeks[0].totalKm).toBeCloseTo(10, 5);
    expect(weeks[1].totalKm).toBeCloseTo(15, 5);
    expect(weeks[1].avgPace).toBe('5:30');
    expect(weeks[1].completionRate).toBe(0.75); // 3 de 4 elegíveis
  });
});

describe('computePreviousWeekAnalysis', () => {
  it('[0]=anterior, [1]=baseline; deriva aderência, esforço/fadiga e volumeChange', () => {
    const a = computePreviousWeekAnalysis([previousGoal, baselineGoal]);
    expect(a).not.toBeNull();
    expect(a!.completedWorkouts).toBe(3);
    expect(a!.totalWorkouts).toBe(4);
    expect(a!.completionRate).toBe(0.75);
    expect(a!.skippedWorkouts).toEqual(['Tiros']);
    expect(a!.avgEffort).toBe(6);
    expect(a!.avgFatigue).toBe(4);
    expect(a!.totalDistanceKm).toBeCloseTo(15, 5);
    expect(a!.volumeChange).toBe('aumentou 50%'); // 15 vs baseline 10
  });

  it('retorna null sem semana anterior', () => {
    expect(computePreviousWeekAnalysis([])).toBeNull();
  });
});
