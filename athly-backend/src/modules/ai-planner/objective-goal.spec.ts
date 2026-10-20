import { assessGoalFeasibility } from './goal-feasibility';
import {
  assessDatedGoal,
  combineFeasibility,
  goalReadinessPrompt,
  healthObjectiveEvidence,
  summarizeAssessment,
} from './objective-goal';
import type { HealthRunItemDto } from './dto/plan-from-health.dto';

const asOf = new Date('2026-10-20T12:00:00Z');
const DAY = 86_400_000;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Corrida registrada por relógio: `daysAgo` dias atrás, `km` a `pace` s/km. */
const run = (n: number, daysAgo: number, km: number, pace = 340): HealthRunItemDto => {
  const start = new Date(asOf.getTime() - daysAgo * DAY - 2 * 3600_000);
  const seconds = km * pace;
  return {
    appleHealthWorkoutUUID: uuid(n),
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + seconds * 1000).toISOString(),
    distanceMeters: km * 1000,
    durationSeconds: seconds,
    sourceBundleIdentifier: 'com.apple.health',
    wasUserEntered: false,
  };
};

/** ~25 km/semana em 7 semanas, maior corrida de 13 km (como o perfil "medio"). */
const medio = (): HealthRunItemDto[] =>
  [
    [1, 12],
    [3, 6],
    [5, 7],
    [8, 11],
    [10, 5],
    [12, 7],
    [15, 13],
    [17, 8],
    [19, 6],
    [22, 10],
    [24, 6],
    [26, 7],
    [29, 12],
    [31, 5],
    [33, 6],
    [36, 10],
    [38, 8],
    [40, 6],
    [43, 9],
    [45, 6],
  ].map(([daysAgo, km], i) => run(i + 1, daysAgo, km));

const evidenceOf = (runs: HealthRunItemDto[]) =>
  healthObjectiveEvidence({
    userId: 'u1',
    runs,
    asOf,
    timeZone: 'America/Sao_Paulo',
    readLimit: 20,
  })!;

const half = (eventDate: string, runs: HealthRunItemDto[], timeSeconds: number | null = 7200) =>
  assessDatedGoal({
    distanceMeters: 21097.5,
    timeSeconds,
    eventDate,
    evidence: evidenceOf(runs),
  })!;

const v1Half = (eventDate: string, currentVdot: number) =>
  assessGoalFeasibility({
    goal: { targetDistance: 'half', targetTime: '2:00:00', eventDate, experienceLevel: null },
    currentVdot,
    asOfISO: '2026-10-19',
  })!;

describe('healthObjectiveEvidence', () => {
  it('cliente antigo, sem a origem das corridas, fica fora do motor objetivo', () => {
    const legacy = medio().map((r) => {
      const copy = { ...r };
      delete copy.sourceBundleIdentifier;
      delete copy.wasUserEntered;
      delete copy.endDate;
      return copy;
    });
    expect(
      healthObjectiveEvidence({
        userId: 'u1',
        runs: legacy,
        asOf,
        timeZone: 'America/Sao_Paulo',
        readLimit: 20,
      }),
    ).toBeNull();
  });

  it('corridas de relógio contam como medida; digitadas à mão não', () => {
    const runs = medio();
    runs[0] = { ...runs[0], wasUserEntered: true };
    const evidence = evidenceOf(runs);
    expect(evidence.runs.filter((r) => r.volumeEligible)).toHaveLength(19);
    expect(evidence.runs.find((r) => r.id === uuid(1))?.provenance).toBe('reported');
  });

  it('sem corridas, a evidência existe mas vazia', () => {
    const evidence = evidenceOf([]);
    expect(evidence.runs).toHaveLength(0);
    expect(evidence.fresh).toBe(false);
  });
});

describe('combineFeasibility', () => {
  it('"pronto" pelo VDOT vira "viável" quando a resistência para a meia não está demonstrada', () => {
    // Maior corrida de 13 km para uma meia (referência: 15,8 km) com 10 semanas pela frente.
    const assessment = half('2026-12-31', medio());
    expect(assessment.assessment.endurance.state).not.toBe('supported');
    const combined = combineFeasibility(v1Half('2026-12-31', 38.6), assessment);
    expect(v1Half('2026-12-31', 38.6).verdict).toBe('ready');
    expect(combined.verdict).toBe('feasible');
    expect(combined.assessment?.endurance).toMatchObject({
      longestKm: 13,
      requiredLongestKm: 15.8,
    });
  });

  it('com a prova em 12 dias e sem resistência, o veredito vira "ambicioso"', () => {
    const combined = combineFeasibility(v1Half('2026-11-01', 38.6), half('2026-11-01', medio()));
    expect(combined.verdict).toBe('ambitious');
  });

  it('quem já correu a distância nas últimas 4 semanas mantém o "pronto"', () => {
    const runs = medio();
    runs[6] = run(7, 15, 21.1, 300); // 21,1 km a 5:00/km há 15 dias
    runs[0] = run(1, 1, 12, 300);
    const assessment = half('2026-12-31', runs);
    expect(summarizeAssessment(assessment)).toMatchObject({
      current: 'supported',
      confidence: 'medium',
      endurance: { state: 'supported', longestKm: 21.1 },
      performance: { state: 'supported' },
    });
    const combined = combineFeasibility(v1Half('2026-12-31', 45), assessment);
    expect(combined.verdict).toBe('ready');
    expect(combined.lowConfidence).toBe(false);
  });

  it('confiança "low" (histórico curto lido pelo app) não marca a estimativa como preliminar', () => {
    // Só as 4 últimas semanas: as 6 semanas da janela da meia não ficam cobertas.
    const runs = medio().slice(0, 12);
    runs[6] = run(7, 15, 21.1, 300);
    const assessment = assessDatedGoal({
      distanceMeters: 21097.5,
      timeSeconds: 7200,
      eventDate: '2026-12-31',
      evidence: healthObjectiveEvidence({
        userId: 'u1',
        runs,
        asOf,
        timeZone: 'America/Sao_Paulo',
        readLimit: 12,
      })!,
    })!;
    expect(assessment.assessment.confidence).toBe('low');
    expect(combineFeasibility(v1Half('2026-12-31', 45), assessment).lowConfidence).toBe(false);
  });

  it('sem evidência objetiva para a distância, a estimativa é preliminar', () => {
    const assessment = half('2026-12-31', []);
    expect(assessment.assessment.confidence).toBe('none');
    expect(combineFeasibility(v1Half('2026-12-31', 30), assessment).lowConfidence).toBe(true);
  });

  it('sem avaliação objetiva (cliente antigo), o v1 segue igual', () => {
    const v1 = v1Half('2026-12-31', 38.6);
    expect(combineFeasibility(v1, null)).toBe(v1);
  });
});

describe('goalReadinessPrompt', () => {
  it('meia em 12 dias sem resistência: avisa o risco com os números', () => {
    const gps = [8, 5, 4, 5, 6, 4, 5, 3.5, 4, 5].map((km, i) => run(i + 1, 2 + i * 4, km, 432));
    const text = goalReadinessPrompt(summarizeAssessment(half('2026-11-01', gps, null)), 21.1);
    expect(text).toContain(
      'Resistência para 21.1 km: NÃO demonstrada — maior corrida recente 8 km',
    );
    expect(text).toContain('A prova é em 12 dia(s).');
    expect(text).toContain('perto demais para construir essa resistência');
  });

  it('sem corridas registradas, diz isso em vez de citar 0 km', () => {
    const text = goalReadinessPrompt(summarizeAssessment(half('2026-11-01', [], null)), 21.1);
    expect(text).toContain('nenhuma corrida recente registrada');
  });

  it('com tempo pela frente, pede para construir sem tratar a meta como garantida', () => {
    const text = goalReadinessPrompt(summarizeAssessment(half('2026-12-31', medio())), 21.1);
    expect(text).toContain('Há tempo para construir a resistência');
  });
});

describe('leitura por janela (runsReadFrom)', () => {
  // Cumpriu um plano de meia: 4 corridas por semana (~37 km) e longões de 16–18 km, em 7 semanas.
  const disciplinado = () => {
    const runs: HealthRunItemDto[] = [];
    for (let week = 0; week < 7; week++) {
      const longao = week % 2 ? 18 : 16;
      for (const [offset, km] of [
        [2, longao],
        [3, 6],
        [5, 8],
        [7, 7],
      ]) {
        runs.push(run(runs.length + 1, offset + 7 * week, km));
      }
    }
    return runs; // da mais recente para a mais antiga
  };
  const endurance = (runs: HealthRunItemDto[], readFrom: Date | null) =>
    summarizeAssessment(
      assessDatedGoal({
        distanceMeters: 21097.5,
        timeSeconds: 7200,
        eventDate: '2026-10-25',
        evidence: healthObjectiveEvidence({
          userId: 'u1',
          runs,
          asOf,
          timeZone: 'America/Sao_Paulo',
          readLimit: 20,
          readFrom,
        })!,
      })!,
    ).endurance;

  it('com só as 20 mais recentes, o volume das 6 semanas da meia fica sem medida', () => {
    const e = endurance(disciplinado().slice(0, 20), null);
    expect(e.state).not.toBe('supported');
    expect(e.weeklyKm).toBeNull();
  });

  it('com as 9 semanas lidas, a resistência de quem cumpriu o plano é demonstrada', () => {
    const e = endurance(disciplinado(), new Date(asOf.getTime() - 63 * DAY));
    expect(e.state).toBe('supported');
    expect(e.weeklyKm).toBeGreaterThan(31.6);
  });
});
