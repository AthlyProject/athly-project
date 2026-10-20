import { buildMacrocycle, longRunReferenceKm, type TrainingPhase } from './periodization';

const PHASE_RANK: Record<TrainingPhase, number> = { base: 0, build: 1, peak: 2, taper: 3, race: 4 };

describe('buildMacrocycle — 16 semanas até um 5k', () => {
  const weeks = buildMacrocycle({
    startMondayISO: '2026-06-01',
    eventDate: '2026-09-21', // 112 dias → raceWeekIndex 16
    targetDistanceMeters: 5000,
    currentWeeklyVolumeKm: 30,
    experienceLevel: 'intermediate',
  });

  it('cobre da semana 0 até a semana da prova (inclusive)', () => {
    expect(weeks).toHaveLength(17);
    expect(weeks[0].weekIndex).toBe(0);
    expect(weeks[16].weekIndex).toBe(16);
  });

  it('última semana é a prova', () => {
    const last = weeks[weeks.length - 1];
    expect(last.phase).toBe('race');
    expect(last.isRaceWeek).toBe(true);
    expect(last.weeksToEvent).toBe(0);
    expect(last.longRunKm).toBe(5); // a própria prova
  });

  it('fases progridem em ordem (base→build→peak→taper→race)', () => {
    for (let i = 1; i < weeks.length; i++) {
      expect(PHASE_RANK[weeks[i].phase]).toBeGreaterThanOrEqual(PHASE_RANK[weeks[i - 1].phase]);
    }
  });

  it('exatamente 1 semana de taper para 5k', () => {
    expect(weeks.filter((w) => w.phase === 'taper')).toHaveLength(1);
  });

  it('weeksToEvent conta regressivamente de 1 em 1', () => {
    for (let i = 0; i < weeks.length; i++) {
      expect(weeks[i].weeksToEvent).toBe(weeks.length - 1 - i);
    }
  });

  it('constrói volume da base ao pico, taper reduz e prova é mínima', () => {
    const trainingVols = weeks
      .filter((w) => w.phase === 'base' || w.phase === 'build' || w.phase === 'peak')
      .map((w) => w.targetVolumeKm);
    const peak = Math.max(...trainingVols);
    expect(peak).toBeGreaterThan(weeks[0].targetVolumeKm); // progrediu
    for (const t of weeks.filter((w) => w.phase === 'taper')) {
      expect(t.targetVolumeKm).toBeLessThan(peak);
    }
    expect(weeks[weeks.length - 1].targetVolumeKm).toBeLessThan(peak); // prova
  });

  it('respeita o teto de volume por experiência e mantém invariantes de longão', () => {
    const peak = Math.max(...weeks.map((w) => w.targetVolumeKm));
    expect(peak).toBeLessThanOrEqual(30 * 1.6 + 0.05); // maxFactor intermediate
    for (const w of weeks) {
      expect(w.targetVolumeKm).toBeGreaterThan(0);
      expect(w.longRunKm).toBeLessThanOrEqual(w.targetVolumeKm);
    }
  });
});

describe('buildMacrocycle — casos de borda', () => {
  it('janela muito curta degrada para taper + prova', () => {
    const w = buildMacrocycle({
      startMondayISO: '2026-06-01',
      eventDate: '2026-06-10', // 9 dias → raceWeekIndex 1
      targetDistanceMeters: 5000,
      currentWeeklyVolumeKm: 30,
    });
    expect(w).toHaveLength(2);
    expect(w[1].isRaceWeek).toBe(true);
  });

  it('evento no passado retorna []', () => {
    expect(
      buildMacrocycle({
        startMondayISO: '2026-06-08',
        eventDate: '2026-06-01',
        targetDistanceMeters: 5000,
        currentWeeklyVolumeKm: 30,
      }),
    ).toEqual([]);
  });

  it('meia maratona recebe taper de 2 semanas', () => {
    const w = buildMacrocycle({
      startMondayISO: '2026-06-01',
      eventDate: '2026-09-21',
      targetDistanceMeters: 21097.5,
      currentWeeklyVolumeKm: 40,
      experienceLevel: 'advanced',
    });
    expect(w.filter((x) => x.phase === 'taper')).toHaveLength(2);
  });
});

describe('buildMacrocycle — longão ancorado no maior treino recente', () => {
  const half = (eventDate: string, currentWeeklyVolumeKm: number, recentLongestRunKm?: number) =>
    buildMacrocycle({
      startMondayISO: '2026-10-19',
      eventDate,
      targetDistanceMeters: 21097.5,
      currentWeeklyVolumeKm,
      experienceLevel: 'intermediate',
      recentLongestRunKm,
    });

  it('na base o longão não fica abaixo de 0,8 × o maior treino recente', () => {
    // 10,2 km/sem e maior treino de 8 km: a fração do volume daria 3,1 km.
    expect(half('2026-12-31', 10.2)[0].longRunKm).toBe(3.1);
    expect(half('2026-12-31', 10.2, 8)[0].longRunKm).toBe(6.4);
  });

  it('na base o longão não passa de 1,1 × o maior treino recente', () => {
    expect(half('2026-12-31', 60, 10)[0].longRunKm).toBe(11);
  });

  it('polimento sem ciclo antes corta 25%, e o longão é 0,65 × o maior treino recente', () => {
    const taper = half('2026-11-01', 22.7, 13)[0];
    expect(taper.phase).toBe('taper');
    expect(taper.targetVolumeKm).toBe(17); // 0,75 × 22,7
    expect(taper.longRunKm).toBe(8.5); // 0,65 × 13
  });

  it('no polimento o longão fica em até metade do teto da semana', () => {
    // 10,2 km/sem: alvo 7,7 km, teto 8,4 km → longão até 4,2 km (0,65 × 8 daria 5,2).
    expect(half('2026-11-01', 10.2, 8)[0].longRunKm).toBe(4.2);
  });

  it('com ciclo antes, o polimento mantém o corte de 50% na semana mais perto da prova', () => {
    const weeks = buildMacrocycle({
      startMondayISO: '2026-06-01',
      eventDate: '2026-09-21',
      targetDistanceMeters: 5000,
      currentWeeklyVolumeKm: 30,
      experienceLevel: 'intermediate',
    });
    const peak = Math.max(...weeks.map((w) => w.targetVolumeKm));
    const taper = weeks.find((w) => w.phase === 'taper')!;
    expect(taper.targetVolumeKm).toBeCloseTo(peak * 0.5, 0);
  });

  it('em prova curta, quem já corre longe mantém o longão acima de 1,6 × a prova', () => {
    const fiveK = (recentLongestRunKm?: number) =>
      buildMacrocycle({
        startMondayISO: '2026-10-19',
        eventDate: '2026-12-01',
        targetDistanceMeters: 5000,
        currentWeeklyVolumeKm: 49.5,
        experienceLevel: 'advanced',
        recentLongestRunKm,
      })[0].longRunKm;
    expect(fiveK()).toBe(8);
    expect(fiveK(21)).toBe(16.8); // 0,8 × 21, abaixo do teto de 21 km
  });
});

describe('longRunReferenceKm', () => {
  const half = 21097.5;

  it('acompanha o maior treino recente, até 10% acima dele', () => {
    const build = (recentLongestRunKm: number) =>
      longRunReferenceKm({
        phase: 'build',
        targetVolumeKm: 60,
        targetDistanceMeters: half,
        recentLongestRunKm,
      });
    expect(build(12)).toBeCloseTo(13.2, 5); // 1,1 × 12
    expect(build(15)).toBeCloseTo(16.5, 5); // 1,1 × 15
  });

  it('na semana da prova a referência é a própria prova', () => {
    expect(
      longRunReferenceKm({
        phase: 'race',
        targetVolumeKm: 11,
        targetDistanceMeters: half,
        recentLongestRunKm: 18,
      }),
    ).toBeCloseTo(21.0975, 5);
  });
});
