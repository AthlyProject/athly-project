import { GeminiService, plannerResponseSchema } from './gemini.service';

const gemini = new GeminiService({ get: () => 'test-key' } as any);

const runSegments = (complete: boolean) =>
  complete
    ? [
        { id: 'wu', kind: 'warmup', target: { rpe: 3 }, end: { by: 'durationSec', value: 600 } },
        { id: 'main', kind: 'work', target: { rpe: 4 }, end: { by: 'distanceM', value: 5000 } },
        { id: 'cd', kind: 'cooldown', target: { rpe: 2 }, end: { by: 'durationSec', value: 300 } },
      ]
    : [{ id: 'main', kind: 'work', target: { rpe: 4 }, end: { by: 'distanceM', value: 5000 } }]; // degenerado: bloco único

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

  it('bloqueia treino antes da data mínima permitida', () => {
    const p = plan(true) as any;
    expect(assessQuality(p, { ...guardrails, minTrainingDate: '2026-07-08' }).join(' ')).toContain(
      'before 2026-07-08',
    );
  });

  describe('semana de avaliação (sem histórico no Health)', () => {
    const assessment = { ...guardrails, assessmentProtocol: true };
    const timed = () => {
      const p = plan(true) as any;
      for (const day of p.weekPlan) {
        if (day.sportType === 'other') continue;
        day.segments[1] = {
          id: 'main',
          kind: 'work',
          target: { rpe: 6 },
          end: { by: 'durationSec', value: 1200 },
        };
      }
      return p;
    };

    it('aceita sessões só por tempo, até RPE 6 e sem pace alvo', () => {
      expect(assessQuality(timed(), assessment)).toEqual([]);
    });

    it('bloqueia distância, tiros, pace alvo e blocos de menos de 5 min', () => {
      const p = timed();
      p.weekPlan[0].segments[1] = {
        id: 'set',
        kind: 'set',
        repetitions: 6,
        children: [
          {
            id: 'rep',
            kind: 'work',
            target: { rpe: 9, paceSecPerKmMin: 280 },
            end: { by: 'distanceM', value: 400 },
          },
          {
            id: 'rec',
            kind: 'recovery',
            target: { rpe: 2 },
            end: { by: 'durationSec', value: 90 },
          },
        ],
      };
      p.weekPlan[2].segments[1].end.value = 120;
      const defects = assessQuality(p, assessment).join(' ');
      expect(defects).toContain('2026-07-06/rep: assessment segments must end by durationSec');
      expect(defects).toContain('2026-07-06/rep: assessment allows RPE <= 6');
      expect(defects).toContain('2026-07-06/rep: assessment must not prescribe pace');
      expect(defects).toContain('2026-07-08/main: assessment work blocks last at least 300s');
    });

    it('fora da avaliação não aplica essas regras', () => {
      expect(assessQuality(plan(true), guardrails).join(' ')).not.toContain('assessment');
    });
  });

  describe('fase BASE', () => {
    const base = { ...guardrails, phase: 'base' as const, longRunRefKm: 7 };
    const withRpe = (p: any, index: number, rpe: number) => {
      p.weekPlan[index].segments[1].target.rpe = rpe;
      return p;
    };

    it('aceita 1 treino de qualidade e bloqueia o segundo', () => {
      const one = withRpe(plan(true), 0, 7);
      expect(assessQuality(one, base).join(' ')).not.toContain('BASE phase');
      const two = withRpe(withRpe(plan(true), 0, 7), 2, 8);
      expect(assessQuality(two, base).join(' ')).toContain(
        'BASE phase allows at most 1 session with a work segment at RPE >= 7; got 2',
      );
    });

    it('conta trabalho dentro de sets', () => {
      const p = withRpe(plan(true), 0, 7);
      p.weekPlan[2].segments[1] = {
        id: 'set',
        kind: 'set',
        repetitions: 4,
        children: [
          { id: 'rep', kind: 'work', target: { rpe: 8 }, end: { by: 'durationSec', value: 120 } },
        ],
      };
      expect(assessQuality(p, base).join(' ')).toContain('got 2');
    });

    it('bloqueia longão acima de 1,25 × a referência', () => {
      const p = plan(true) as any;
      // 10 min + 5 km + 5 min a 6:30/km ≈ 7,3 km: dentro de 7 × 1,25 = 8,75 km.
      expect(assessQuality(p, base).join(' ')).not.toContain('long-run reference');
      p.weekPlan[4].segments[1].end.value = 12000;
      expect(assessQuality(p, base).join(' ')).toContain('exceeds the BASE long-run reference 7km');
    });

    it('fora da BASE não aplica esses limites', () => {
      const p = withRpe(withRpe(plan(true), 0, 7), 2, 8);
      p.weekPlan[4].segments[1].end.value = 12000;
      expect(assessQuality(p, { ...base, phase: 'build' }).join(' ')).not.toMatch(
        /BASE phase|long-run reference/,
      );
    });
  });

  describe('semana da prova', () => {
    // Prova no sábado 11/07: véspera na sexta (10/07), antevéspera na quinta (09/07, descanso).
    const raceWeek = { ...guardrails, raceDate: '2026-07-11' };
    const eve = (segments: unknown[]) => {
      const p = plan(true) as any;
      p.weekPlan[4].segments = segments;
      return p;
    };
    const activation = [
      { id: 'wu', kind: 'warmup', target: { rpe: 3 }, end: { by: 'durationSec', value: 600 } },
      { id: 'main', kind: 'work', target: { rpe: 6 }, end: { by: 'distanceM', value: 1000 } },
      { id: 'cd', kind: 'cooldown', target: { rpe: 2 }, end: { by: 'durationSec', value: 300 } },
    ];

    it('aceita na véspera uma ativação curta com ~1 km no ritmo de prova', () => {
      expect(assessQuality(eve(activation), raceWeek).join(' ')).not.toContain('before the race');
    });

    it('aceita tiros curtos na véspera somando as repetições', () => {
      const strides = [
        activation[0],
        {
          id: 'set',
          kind: 'set',
          repetitions: 4,
          children: [
            { id: 'rep', kind: 'work', target: { rpe: 6 }, end: { by: 'durationSec', value: 20 } },
            {
              id: 'rec',
              kind: 'recovery',
              target: { rpe: 2 },
              end: { by: 'durationSec', value: 60 },
            },
          ],
        },
        activation[2],
      ];
      expect(assessQuality(eve(strides), raceWeek).join(' ')).not.toContain('before the race');
    });

    it('bloqueia na véspera RPE 7, treino longo ou trecho forte comprido', () => {
      const forte = eve(activation);
      forte.weekPlan[4].segments[1].target.rpe = 7;
      expect(assessQuality(forte, raceWeek).join(' ')).toContain('day before the race');
      // O treino padrão do plano (10 min + 5 km + 5 min ≈ 47 min) passa de 30 min.
      expect(assessQuality(plan(true), raceWeek).join(' ')).toContain('day before the race');
      const comprido = eve(activation);
      comprido.weekPlan[4].segments[1].end.value = 3000;
      expect(assessQuality(comprido, raceWeek).join(' ')).toContain('3.0 km above RPE 4');
    });

    it('bloqueia na antevéspera trecho acima de RPE 4', () => {
      // Prova no domingo 12/07: antevéspera na sexta (10/07).
      const p = plan(true) as any;
      p.weekPlan[4].segments[1].target.rpe = 6;
      const defects = assessQuality(p, { ...guardrails, raceDate: '2026-07-12' }).join(' ');
      expect(defects).toContain('2026-07-10 is two days before the race');
    });

    it('fora da semana da prova não aplica esses limites', () => {
      expect(assessQuality(plan(true), guardrails).join(' ')).not.toContain('before the race');
    });
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
    const generateJson = mockJsonReturning([
      JSON.stringify(plan(false)),
      JSON.stringify(plan(true)),
    ]);
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
  it('não envia maxOutputTokens nem temperature para o Gemini', async () => {
    const generateContent = jest.fn(async (request: { config: unknown }) => {
      expect(request.config).toBeDefined();
      return {
        text: JSON.stringify(plan(true)),
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150,
        },
      };
    });
    const service = new GeminiService({ get: () => 'test-key' } as any);
    (service as any).getClient = jest.fn(() => ({
      models: { generateContent },
    }));

    await (service as any).generateJson('PROMPT', 'gemini-3-flash-preview', { type: 'object' });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('maxOutputTokens');
    // Gemini 3 abaixo de 1.0 entra em loop no raciocínio.
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty('temperature');
  });
});

describe('plannerResponseSchema — alvo dos segmentos', () => {
  const segments = (
    plannerResponseSchema.properties.weekPlan.items.properties.segments.items as any
  ).anyOf;
  const targets = [
    segments[0].properties.target,
    segments[1].properties.children.items.properties.target,
  ];

  it('pede rpe antes de hrZone, com limites, nos segmentos e dentro de sets', () => {
    for (const target of targets) {
      const keys = Object.keys(target.properties);
      expect(keys.indexOf('rpe')).toBeLessThan(keys.indexOf('hrZone'));
      expect(target.properties.rpe).toMatchObject({ minimum: 1, maximum: 10 });
      expect(target.properties.hrZone).toMatchObject({ minimum: 1, maximum: 5 });
    }
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
