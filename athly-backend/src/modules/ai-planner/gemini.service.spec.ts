import { GeminiService } from './gemini.service';

const gemini = new GeminiService({ get: () => 'test-key' } as any);

const runSegments = (complete: boolean) =>
  complete
    ? [
        { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 } },
        { id: 'main', kind: 'work', end: { by: 'distanceM', value: 5000 } },
        { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 } },
      ]
    : [{ id: 'main', kind: 'work', end: { by: 'distanceM', value: 5000 } }]; // degenerado: bloco único

const runDay = (date: string, complete: boolean) => ({
  date,
  dayOfWeek: 'Monday',
  title: 'Corrida',
  description: 'd',
  sportType: 'running',
  intensity: 5,
  reasoning: 'porque sim',
  segments: runSegments(complete),
});

const restDay = (date: string) => ({
  date,
  dayOfWeek: 'Sunday',
  title: 'Descanso',
  description: 'd',
  sportType: 'other',
  intensity: 1,
  segments: [{ id: 'rest', kind: 'rest', end: { by: 'durationSec', value: 0 } }],
});

const plan = (complete: boolean) => ({
  analysis: {
    title: 't',
    runsAnalyzed: 1,
    period: 'p',
    avgDistanceKm: 5,
    avgPace: '5:00',
    avgHeartRate: null,
    totalDistanceKm: 5,
    trend: 'maintaining',
    fitnessInsights: 'x',
  },
  weekPlan: [
    runDay('2026-07-06', complete),
    restDay('2026-07-07'),
    runDay('2026-07-08', complete),
    restDay('2026-07-09'),
    runDay('2026-07-10', complete),
    restDay('2026-07-11'),
    restDay('2026-07-12'),
  ],
});

const mockModelReturning = (responses: string[]) => {
  let i = 0;
  return {
    generateContent: jest.fn(async () => ({
      response: { text: () => responses[Math.min(i++, responses.length - 1)] },
    })),
  };
};

describe('GeminiService.assessStructure', () => {
  const assess = (wp: unknown) => (gemini as any).assessStructure(wp);

  it('marca como degenerados os dias de corrida sem warmup/cooldown', () => {
    expect(assess(plan(false).weekPlan)).toHaveLength(3);
  });

  it('não marca nada quando a semana está completa', () => {
    expect(assess(plan(true).weekPlan)).toHaveLength(0);
  });

  it('não marca dias de descanso (sportType other)', () => {
    expect(assess([restDay('2026-07-07')])).toHaveLength(0);
  });
});

describe('GeminiService.assessPlanQuality', () => {
  const assessQuality = (p: unknown, guardrails: unknown) =>
    (gemini as any).assessPlanQuality(p, guardrails);
  const guardrails = {
    weekDates: [
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ],
    availableDays: ['monday', 'wednesday', 'friday'],
    weeklyVolumeMaxKm: 100,
    goalAttemptAllowed: false,
    defaultPaceSecPerKm: 390,
  };

  it('bloqueia tentativa de objetivo quando o backend marcou feasibility=false', () => {
    const p = plan(true) as any;
    p.weekPlan[0].isGoalAttempt = true;
    expect(assessQuality(p, guardrails).join(' ')).toContain('isGoalAttempt=true');
  });

  it('bloqueia treino em dia fora da disponibilidade', () => {
    const p = plan(true) as any;
    expect(assessQuality(p, { ...guardrails, availableDays: ['wednesday'] }).join(' ')).toContain(
      'outside available days',
    );
  });

  it('bloqueia volume planejado acima do teto calculado pelo backend', () => {
    const p = plan(true) as any;
    expect(assessQuality(p, { ...guardrails, weeklyVolumeMaxKm: 5 }).join(' ')).toContain(
      'planned volume',
    );
  });
});

describe('GeminiService.runWithStructureGate', () => {
  it('regenera quando vem degenerado e aceita a tentativa boa', async () => {
    const model = mockModelReturning([JSON.stringify(plan(false)), JSON.stringify(plan(true))]);
    (gemini as any).getModel = () => model;

    const res = await (gemini as any).runWithStructureGate('PROMPT');

    expect(model.generateContent).toHaveBeenCalledTimes(2);
    expect(res.parsed.weekPlan).toHaveLength(7);
  });

  it('lança erro (não persiste) se continuar degenerado após o máximo de tentativas', async () => {
    const model = mockModelReturning([JSON.stringify(plan(false))]);
    (gemini as any).getModel = () => model;

    await expect((gemini as any).runWithStructureGate('PROMPT')).rejects.toThrow();
    expect(model.generateContent).toHaveBeenCalledTimes(3); // MAX_STRUCTURE_ATTEMPTS
  });
});
