import { buildFitPlan } from './workout-fit-plan';
import { toWatchPlan } from './workout-watch-plan';

const DATE = new Date('2026-10-07T00:00:00.000Z');

const planOf = (segments: unknown[]) => {
  const result = buildFitPlan({
    id: 'w1',
    title: 'Intervalado',
    dateScheduled: DATE,
    sportType: 'running',
    segments: { schemaVersion: 1, sport: 'running', segments },
  });
  if (!result.ok) throw new Error(result.reason);
  return result.plan;
};

describe('toWatchPlan', () => {
  const segments = [
    {
      id: 'wu',
      kind: 'warmup',
      label: 'Aquecimento',
      end: { by: 'durationSec', value: 600 },
      target: { rpe: 3 },
    },
    {
      id: 'set',
      kind: 'set',
      repetitions: 6,
      children: [
        {
          id: 'work',
          kind: 'work',
          label: '400m forte',
          end: { by: 'distanceM', value: 400 },
          target: { paceSecPerKmMin: 310, paceSecPerKmMax: 320 },
        },
        {
          id: 'rec',
          kind: 'recovery',
          end: { by: 'durationSec', value: 90 },
          target: { hrZone: 2 },
        },
      ],
    },
    { id: 'cd', kind: 'cooldown', label: 'Volta à calma', end: { by: 'durationSec', value: 300 } },
  ];

  it('converte os passos do FIT para o player do relógio', () => {
    const plan = planOf(segments);
    const watch = toWatchPlan(plan);

    expect(watch.rev).toBe(plan.rev);
    expect(watch.name).toBe('07/10 Intervalado');
    expect(watch.steps).toEqual([
      {
        name: 'Aquecimento',
        notes: 'RPE 3',
        intensity: 'warmup',
        duration: { type: 'time', value: 600 },
        target: null,
      },
      {
        name: '400m forte',
        intensity: 'active',
        duration: { type: 'distance', value: 400 },
        // 5:10–5:20 já sai alargada para 5:05–5:25, a mesma faixa do FIT.
        target: { type: 'pace', fastSecPerKm: 305, slowSecPerKm: 325 },
      },
      {
        name: 'Recuperação',
        intensity: 'recovery',
        duration: { type: 'time', value: 90 },
        target: { type: 'hr', zone: 2 },
      },
      { repeatFrom: 1, times: 6 },
      {
        name: 'Volta à calma',
        intensity: 'cooldown',
        duration: { type: 'time', value: 300 },
        target: null,
      },
    ]);
  });

  it('passo por repetições vira passo aberto (fecha com o botão de volta)', () => {
    const watch = toWatchPlan(
      planOf([
        { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 } },
        { id: 'drill', kind: 'work', label: 'Educativo', end: { by: 'reps', value: 10 } },
        { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 } },
      ]),
    );

    expect(watch.steps[1]).toMatchObject({ name: 'Educativo', duration: { type: 'open' } });
  });
});
