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

const usage = (overrides: Partial<any> = {}) => ({
  model: 'gemini-3-flash-preview',
  inputTokens: 1000,
  outputTokens: 500,
  thinkingTokens: 0,
  totalTokens: 1500,
  estimatedCostUsd: 0.002,
  pricing: {
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 3,
    source: 'ai.google.dev/pricing',
  },
  attempts: 1,
  tokenSource: 'usageMetadata',
  ...overrides,
});

const mockJsonReturning = (responses: string[]) => {
  let i = 0;
  return jest.fn(async () => ({
    rawResponse: responses[Math.min(i++, responses.length - 1)],
    usage: usage(),
  }));
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
    const generateJson = mockJsonReturning([JSON.stringify(plan(false)), JSON.stringify(plan(true))]);
    (gemini as any).generateJson = generateJson;

    const res = await (gemini as any).runWithStructureGate(
      'PROMPT',
      undefined,
      'gemini-3-flash-preview',
    );

    expect(generateJson).toHaveBeenCalledTimes(2);
    expect(res.parsed.weekPlan).toHaveLength(7);
    expect(res.usage.attempts).toBe(2);
  });

  it('lança erro (não persiste) se continuar degenerado após o máximo de tentativas', async () => {
    const generateJson = mockJsonReturning([JSON.stringify(plan(false))]);
    (gemini as any).generateJson = generateJson;

    await expect(
      (gemini as any).runWithStructureGate('PROMPT', undefined, 'gemini-3-flash-preview'),
    ).rejects.toThrow();
    expect(generateJson).toHaveBeenCalledTimes(3); // MAX_STRUCTURE_ATTEMPTS
  });
});

describe('GeminiService.generateJson', () => {
  it('não envia limite manual de maxOutputTokens para o Gemini', async () => {
    const generateContent = jest.fn(async () => ({
      text: JSON.stringify(plan(true)),
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        totalTokenCount: 150,
      },
    }));
    const service = new GeminiService({ get: () => 'test-key' } as any);
    (service as any).getClient = jest.fn(() => ({
      models: { generateContent },
    }));

    await (service as any).generateJson('PROMPT', 'gemini-3-flash-preview', { type: 'object' });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('maxOutputTokens');
  });
});

describe('GeminiService.costEstimate', () => {
  it('calcula custo por 1M tokens para gemini-2.5-flash', () => {
    const res = (gemini as any).withCost(
      usage({
        model: 'gemini-2.5-flash',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        estimatedCostUsd: null,
      }),
    );

    expect(res.estimatedCostUsd).toBe(2.8);
    expect(res.pricing.inputUsdPer1M).toBe(0.3);
    expect(res.pricing.outputUsdPer1M).toBe(2.5);
  });

  it('calcula custo por 1M tokens para gemini-3-flash-preview', () => {
    const res = (gemini as any).withCost(
      usage({
        model: 'gemini-3-flash-preview',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
        estimatedCostUsd: null,
      }),
    );

    expect(res.estimatedCostUsd).toBe(3.5);
    expect(res.pricing.inputUsdPer1M).toBe(0.5);
    expect(res.pricing.outputUsdPer1M).toBe(3);
  });
});
