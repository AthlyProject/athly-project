import { buildMacrocycle, type TrainingPhase } from './periodization';

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
