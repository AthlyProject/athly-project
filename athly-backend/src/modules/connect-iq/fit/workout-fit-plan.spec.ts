import { buildFitPlan, fitWorkoutName, FitWorkoutSource } from './workout-fit-plan';
import { sanitizeFitText } from './fit-text';

const DATE = new Date('2026-10-07T00:00:00.000Z');

const wu = {
  id: 'wu',
  kind: 'warmup',
  label: 'Aquecimento',
  end: { by: 'durationSec', value: 600 },
  target: { rpe: 3 },
};
const cd = {
  id: 'cd',
  kind: 'cooldown',
  label: 'Volta à calma',
  end: { by: 'durationSec', value: 300 },
  target: { rpe: 2 },
};
const repeats = {
  id: 'set',
  kind: 'set',
  repetitions: 6,
  children: [
    {
      id: 'work',
      kind: 'work',
      label: '400m forte',
      end: { by: 'distanceM', value: 400 },
      target: { paceSecPerKmMin: 280, paceSecPerKmMax: 295 },
    },
    {
      id: 'rec',
      kind: 'recovery',
      label: 'Recuperação',
      end: { by: 'durationSec', value: 90 },
      target: { rpe: 3 },
    },
  ],
};

const workout = (segments: unknown, overrides: Partial<FitWorkoutSource> = {}) => ({
  id: '3f2a9c1e-0000-4000-8000-000000000001',
  title: 'Intervalado 6x400m',
  dateScheduled: DATE,
  sportType: 'running',
  segments: { schemaVersion: 1, sport: 'running', segments },
  ...overrides,
});

const work = (target: object, end: object = { by: 'distanceM', value: 1000 }) => ({
  id: 'w',
  kind: 'work',
  label: 'Ritmo',
  end,
  target,
});

const stepsOf = (segments: unknown[]) => {
  const result = buildFitPlan(workout(segments));
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.plan.steps;
};

describe('buildFitPlan', () => {
  it('converte o treino de tiros em passos com repetição nativa', () => {
    const result = buildFitPlan(workout([wu, repeats, cd]));

    expect(result).toEqual({
      ok: true,
      plan: {
        name: '07/10 Intervalado 6x400m',
        rev: expect.stringMatching(/^[0-9a-f]{12}$/),
        steps: [
          {
            wktStepName: 'Aquecimento',
            notes: 'RPE 3',
            intensity: 'warmup',
            durationType: 'time',
            durationValue: 600_000,
            targetType: 'open',
          },
          {
            wktStepName: '400m forte',
            intensity: 'active',
            durationType: 'distance',
            durationValue: 40_000,
            targetType: 'speed',
            targetValue: 0,
            customTargetValueLow: 3390,
            customTargetValueHigh: 3571,
          },
          {
            wktStepName: 'Recuperação',
            notes: 'RPE 3',
            intensity: 'recovery',
            durationType: 'time',
            durationValue: 90_000,
            targetType: 'open',
          },
          { durationType: 'repeatUntilStepsCmplt', durationValue: 1, targetValue: 6 },
          {
            wktStepName: 'Volta à calma',
            notes: 'RPE 2',
            intensity: 'cooldown',
            durationType: 'time',
            durationValue: 300_000,
            targetType: 'open',
          },
        ],
      },
    });
  });

  it('acolchoa pace único em ±10 s/km (só mínimo informado)', () => {
    const [step] = stepsOf([work({ paceSecPerKmMin: 280 })]);
    // 290 s/km (lento) → 3448 mm/s · 270 s/km (rápido) → 3704 mm/s
    expect(step).toMatchObject({ customTargetValueLow: 3448, customTargetValueHigh: 3704 });
  });

  it('acolchoa pace único quando só o máximo vem preenchido', () => {
    const [step] = stepsOf([work({ paceSecPerKmMax: 360 })]);
    expect(step).toMatchObject({ customTargetValueLow: 2703, customTargetValueHigh: 2857 });
  });

  it('corrige limites invertidos (mínimo maior que o máximo)', () => {
    const [step] = stepsOf([work({ paceSecPerKmMin: 300, paceSecPerKmMax: 280 })]);
    expect(step).toMatchObject({ customTargetValueLow: 3333, customTargetValueHigh: 3571 });
  });

  it('ignora pace fora da faixa plausível e cai para alvo aberto', () => {
    const [step] = stepsOf([work({ paceSecPerKmMin: 60, paceSecPerKmMax: 5000 })]);
    expect(step.targetType).toBe('open');
    expect(step.customTargetValueLow).toBeUndefined();
  });

  it('usa a zona de FC do relógio quando não há pace', () => {
    const [step] = stepsOf([work({ hrZone: 3 })]);
    expect(step).toMatchObject({ targetType: 'heartRate', targetValue: 3 });
  });

  it('com pace e zona, o pace é o alvo e a zona vai para as notas', () => {
    const [step] = stepsOf([
      work({ paceSecPerKmMin: 330, paceSecPerKmMax: 345, hrZone: 2, rpe: 4 }),
    ]);
    expect(step).toMatchObject({ targetType: 'speed', notes: 'Z2 · RPE 4' });
  });

  it('junta cue com o RPE nas notas', () => {
    const [step] = stepsOf([{ ...work({ rpe: 7 }), cue: 'Mantenha a postura' }]);
    expect(step).toMatchObject({ targetType: 'open', notes: 'Mantenha a postura · RPE 7' });
  });

  it('transforma fim por repetições em passo aberto (botão de volta)', () => {
    const [step] = stepsOf([work({}, { by: 'reps', value: 10 })]);
    expect(step).toMatchObject({ durationType: 'open' });
    expect(step.durationValue).toBeUndefined();
  });

  it('descarta passos com duração zero', () => {
    const steps = stepsOf([wu, work({}, { by: 'durationSec', value: 0 }), cd]);
    expect(steps.map((s) => s.intensity)).toEqual(['warmup', 'cooldown']);
  });

  it('desenrola set aninhado dentro da repetição externa', () => {
    const nested = {
      id: 'outer',
      kind: 'set',
      repetitions: 2,
      children: [
        work({}, { by: 'distanceM', value: 200 }),
        {
          id: 'inner',
          kind: 'set',
          repetitions: 3,
          children: [
            work({}, { by: 'distanceM', value: 100 }),
            { id: 'r', kind: 'recovery', end: { by: 'durationSec', value: 30 } },
          ],
        },
      ],
    };

    const steps = stepsOf([wu, nested]);

    // wu + (200m + 3×(100m + 30s)) + repeat
    expect(steps).toHaveLength(1 + 1 + 6 + 1);
    expect(steps.filter((s) => s.durationType === 'repeatUntilStepsCmplt')).toEqual([
      { durationType: 'repeatUntilStepsCmplt', durationValue: 1, targetValue: 2 },
    ]);
  });

  it('não cria passo de repetição para set de uma volta só', () => {
    const steps = stepsOf([{ ...repeats, repetitions: 1 }]);
    expect(steps.map((s) => s.durationType)).toEqual(['distance', 'time']);
  });

  it('usa os rótulos padrão do app quando o segmento não tem label', () => {
    const steps = stepsOf([{ id: 'r', kind: 'recovery', end: { by: 'durationSec', value: 60 } }]);
    expect(steps[0].wktStepName).toBe('Recuperação');
  });

  it('recusa treinos acima do limite de 50 passos', () => {
    const huge = {
      id: 'outer',
      kind: 'set',
      repetitions: 2,
      children: [
        {
          id: 'inner',
          kind: 'set',
          repetitions: 30,
          children: [
            work({}),
            { id: 'r', kind: 'recovery', end: { by: 'durationSec', value: 30 } },
          ],
        },
      ],
    };
    expect(buildFitPlan(workout([huge]))).toEqual({ ok: false, reason: 'too_many_steps' });
  });

  it('ignora dias de descanso e esportes que não são corrida', () => {
    expect(buildFitPlan(workout([wu], { sportType: 'other' }))).toEqual({
      ok: false,
      reason: 'unsupported_sport',
    });
    expect(buildFitPlan(workout([wu], { sportType: 'walking' }))).toEqual({
      ok: false,
      reason: 'unsupported_sport',
    });
  });

  it('trata árvore ausente, vazia ou inválida', () => {
    expect(buildFitPlan(workout([], { segments: null }))).toEqual({
      ok: false,
      reason: 'no_segments',
    });
    expect(buildFitPlan(workout([]))).toEqual({ ok: false, reason: 'no_segments' });
    expect(buildFitPlan(workout([{ id: 's', kind: 'set', repetitions: 2 }]))).toEqual({
      ok: false,
      reason: 'invalid_segments',
    });
    const onlyZero = [work({}, { by: 'durationSec', value: 0 })];
    expect(buildFitPlan(workout(onlyZero))).toEqual({ ok: false, reason: 'empty' });
  });

  it('aceita a árvore como array puro (linhas antigas)', () => {
    const result = buildFitPlan(workout([], { segments: [wu, cd] }));
    expect(result.ok).toBe(true);
  });

  it('mantém o rev estável e muda quando o FIT mudaria', () => {
    const base = buildFitPlan(workout([wu, repeats, cd]));
    const same = buildFitPlan(workout([wu, repeats, cd]));
    const fasterRepeats = {
      ...repeats,
      children: [work({ paceSecPerKmMin: 270, paceSecPerKmMax: 285 }), repeats.children[1]],
    };
    const changedPace = buildFitPlan(workout([wu, fasterRepeats, cd]));
    const moved = buildFitPlan(
      workout([wu, repeats, cd], { dateScheduled: new Date('2026-10-08T00:00:00.000Z') }),
    );

    if (!base.ok || !same.ok || !changedPace.ok || !moved.ok) throw new Error('expected ok');
    expect(same.plan.rev).toBe(base.plan.rev);
    expect(changedPace.plan.rev).not.toBe(base.plan.rev);
    expect(moved.plan.rev).not.toBe(base.plan.rev);
  });
});

describe('fitWorkoutName', () => {
  it('prefixa a data e cabe no limite do relógio', () => {
    expect(fitWorkoutName('Intervalado 6×400m — forte 🔥', DATE)).toBe('07/10 Intervalado 6x400m');
    expect(fitWorkoutName('Rodagem leve', new Date('2026-01-03T00:00:00.000Z'))).toBe(
      '03/01 Rodagem leve',
    );
  });
});

describe('sanitizeFitText', () => {
  it('mantém acentos e troca pontuação tipográfica por ASCII', () => {
    expect(sanitizeFitText('Recuperação “leve” – 2×', 40)).toBe('Recuperação "leve" - 2x');
  });

  it('remove emoji e controles e colapsa espaços', () => {
    expect(sanitizeFitText('  Tiro\n🔥  forte\t ', 40)).toBe('Tiro forte');
  });

  it('corta por caracteres, não por bytes', () => {
    expect(sanitizeFitText('Aquecimento progressivo', 11)).toBe('Aquecimento');
    expect(sanitizeFitText('ééééé', 3)).toBe('ééé');
  });

  it('devolve vazio para nulo', () => {
    expect(sanitizeFitText(undefined, 10)).toBe('');
  });
});
