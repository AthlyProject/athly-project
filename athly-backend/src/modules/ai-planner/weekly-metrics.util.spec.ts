import {
  adherenceEligibleWorkouts,
  executedVolumeKm,
  computeLongitudinalWeeks,
  computePreviousWeekAnalysis,
  healthLongestRunKm,
  healthWeeklyVolume,
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

  it('corrige fragmento de HealthKit usando sessão detalhada maior no mesmo dia', () => {
    const workouts = [
      wk({
        id: 'w-frag',
        status: 'done',
        dateScheduled: new Date('2026-07-03T00:00:00Z'),
        actualDistanceMeters: 340,
        blocks: [{ distance: 3.8 }],
        feedback: [{ effort: 7, fatigue: 6, completed: true }],
      }),
    ];

    const detailedSessions = [
      {
        startDate: '2026-07-03T08:00:00Z',
        appleHealthWorkoutUUID: 'fragment',
        distanceMeters: 340,
        durationSeconds: 150,
      },
      {
        startDate: '2026-07-03T08:10:00Z',
        appleHealthWorkoutUUID: 'full-run',
        distanceMeters: 3950,
        durationSeconds: 1380,
      },
    ];

    expect(executedVolumeKm(workouts, { detailedSessions })).toBeCloseTo(3.95, 5);
  });

  it('mantém distância baixa quando não há evidência detalhada melhor', () => {
    const workouts = [
      wk({
        status: 'done',
        actualDistanceMeters: 340,
        blocks: [{ distance: 3.8 }],
        feedback: [{ effort: 10, fatigue: 10, completed: false }],
      }),
    ];

    expect(executedVolumeKm(workouts)).toBeCloseTo(0.34, 5);
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

describe('healthWeeklyVolume', () => {
  // Semana planejada começa na segunda 19/10; as 4 anteriores começam em 21/09, 28/09, 05/10, 12/10.
  const weekStart = '2026-10-19';
  const run = (day: string, km: number) => ({
    startDate: `${day}T10:00:00Z`,
    distanceMeters: km * 1000,
  });

  it('usa a média das 4 semanas reais, não distância média × dias disponíveis', () => {
    const runs = [
      run('2026-10-18', 9),
      run('2026-10-14', 10),
      run('2026-10-11', 15),
      run('2026-10-07', 10),
      run('2026-10-04', 12),
      run('2026-09-30', 8),
      run('2026-09-27', 12),
      run('2026-09-23', 10),
      run('2026-09-01', 7),
    ];
    // Semanas: 19, 25, 20, 22 km → 21.5 km. A conta antiga daria 10.3 km × 4 dias = 41 km.
    expect(healthWeeklyVolume(runs, weekStart)).toEqual({ km: 21.5, weeksMeasured: 4 });
  });

  it('ignora semanas anteriores à corrida mais antiga recebida', () => {
    // Histórico cortado em 03/10: a semana de 28/09 estaria incompleta.
    const runs = [run('2026-10-15', 10), run('2026-10-08', 8), run('2026-10-03', 20)];
    expect(healthWeeklyVolume(runs, weekStart)).toEqual({ km: 9, weeksMeasured: 2 });
  });

  it('não conta corridas da própria semana planejada', () => {
    const runs = [run('2026-10-20', 30), run('2026-10-13', 10), run('2026-09-01', 5)];
    expect(healthWeeklyVolume(runs, weekStart)).toEqual({ km: 2.5, weeksMeasured: 4 });
  });

  it('atleta parado há 4+ semanas usa a média semanal de todo o período', () => {
    // 30 km entre 31/08 e 13/09, nada depois: 7 semanas até 19/10.
    const runs = [run('2026-09-13', 10), run('2026-09-06', 10), run('2026-08-31', 10)];
    const volume = healthWeeklyVolume(runs, weekStart);
    expect(volume?.weeksMeasured).toBe(0);
    expect(volume?.km).toBeCloseTo(30 / 7, 5);
  });

  it('histórico de menos de 1 semana devolve o total, sem semanas medidas', () => {
    const runs = [run('2026-10-17', 5), run('2026-10-15', 4)];
    expect(healthWeeklyVolume(runs, weekStart)).toEqual({ km: 9, weeksMeasured: 0 });
  });

  it('sem corridas antes da semana planejada devolve null', () => {
    expect(healthWeeklyVolume([], weekStart)).toBeNull();
    expect(healthWeeklyVolume([run('2026-10-19', 5)], weekStart)).toBeNull();
  });
});

describe('healthLongestRunKm', () => {
  const run = (day: string, km: number) => ({
    startDate: `${day}T10:00:00Z`,
    distanceMeters: km * 1000,
  });

  it('pega a maior corrida das 4 semanas antes da semana planejada', () => {
    const runs = [
      run('2026-10-20', 21),
      run('2026-10-18', 9),
      run('2026-10-11', 13),
      run('2026-09-20', 18),
    ];
    // 20/10 é da própria semana e 20/09 fica antes de 21/09.
    expect(healthLongestRunKm(runs, '2026-10-19')).toBe(13);
  });

  it('sem corrida no intervalo devolve null', () => {
    expect(healthLongestRunKm([run('2026-09-01', 10)], '2026-10-19')).toBeNull();
    expect(healthLongestRunKm([], '2026-10-19')).toBeNull();
  });
});
