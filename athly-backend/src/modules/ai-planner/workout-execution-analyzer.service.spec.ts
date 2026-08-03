import { WorkoutExecutionAnalyzerService } from './workout-execution-analyzer.service';
import { SegmentLabel, DetailedSessionDto } from './dto/plan-from-health.dto';
import { flattenToLegacyBlocks } from '../workouts/utils/flatten-to-legacy';
import type { Segment } from '../workouts/types/segment.types';

// Os métodos exercitados aqui não tocam o Prisma — o service é construído com um stub.
const service = new WorkoutExecutionAnalyzerService({} as any);

const tempoRunTree: Segment[] = [
  { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 }, target: { rpe: 3 } },
  {
    id: 'tempo',
    kind: 'work',
    end: { by: 'durationSec', value: 1200 },
    target: { paceSecPerKmMin: 330, paceSecPerKmMax: 345, rpe: 7 },
  },
  { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 }, target: { rpe: 2 } },
];

const intervalTree: Segment[] = [
  { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 }, target: { rpe: 3 } },
  {
    id: 'set',
    kind: 'set',
    repetitions: 6,
    children: [
      {
        id: 'work',
        kind: 'work',
        end: { by: 'distanceM', value: 400 },
        target: { paceSecPerKmMin: 280, paceSecPerKmMax: 295 },
      },
      { id: 'rec', kind: 'recovery', end: { by: 'durationSec', value: 90 }, target: { rpe: 3 } },
    ],
  },
  { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 }, target: { rpe: 2 } },
];

function workoutWith(tree: Segment[], blocks: unknown[] = []) {
  return {
    id: 'w1',
    dateScheduled: new Date('2026-06-08T00:00:00Z'),
    title: 'Treino',
    intensity: 6,
    description: 'desc',
    blocks,
    segments: { schemaVersion: 1, sport: 'running', segments: tree },
  };
}

/** Sessão de tempo run: warmup 6:50, 4km de tempo a 5:35, cooldown 7:00 — splits 'easy' por km (route). */
function tempoSession(): DetailedSessionDto {
  const splits = [
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 410, avgPaceSecondsPerKm: 410 }, // warmup
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 400, avgPaceSecondsPerKm: 400 }, // resto do warmup
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 335, avgPaceSecondsPerKm: 335 },
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 338, avgPaceSecondsPerKm: 338 },
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 333, avgPaceSecondsPerKm: 333 },
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 336, avgPaceSecondsPerKm: 336 },
    { label: SegmentLabel.easy, distanceKm: 1, durationSeconds: 420, avgPaceSecondsPerKm: 420 }, // cooldown
  ];
  const durationSeconds = splits.reduce((s, x) => s + x.durationSeconds, 0);
  return {
    startDate: '2026-06-08T08:00:00.000Z',
    appleHealthWorkoutUUID: 'uuid-1',
    distanceMeters: 7000,
    durationSeconds,
    averagePaceSecondsPerKm: durationSeconds / 7,
    segments: splits as any,
    splitsSource: 'route',
  } as DetailedSessionDto;
}

describe('WorkoutExecutionAnalyzerService — percepção de pace', () => {
  it('aceita execução importada sem UUID do Apple Health', () => {
    const persisted = (service as any).extractPersistedExecutionDetails(
      {
        startDate: '2026-07-29T10:00:00.000Z',
        distanceMeters: 5000,
        durationSeconds: 1800,
        averagePaceSecondsPerKm: 360,
        segments: [],
        splitsSource: 'route',
      },
      'workout-importado',
    );

    expect(persisted).toMatchObject({
      athlyWorkoutId: 'workout-importado',
      distanceMeters: 5000,
    });
    expect(persisted.appleHealthWorkoutUUID).toBeUndefined();
  });

  it('extrai a faixa de pace real (min–max) da árvore de segments', () => {
    const prescribed = (service as any).summarizePrescribed(workoutWith(tempoRunTree));
    expect(prescribed.targetPaceRange).toEqual({ minSecPerKm: 330, maxSecPerKm: 345 });
    expect(prescribed.warmupSeconds).toBe(600);
    expect(prescribed.cooldownSeconds).toBe(300);
    expect(prescribed.expectedRepCount).toBeUndefined();
  });

  it('extrai reps e distância de tiro de um set', () => {
    const prescribed = (service as any).summarizePrescribed(workoutWith(intervalTree));
    expect(prescribed.expectedRepCount).toBe(6);
    expect(prescribed.expectedRepDistanceKm).toBeCloseTo(0.4);
    expect(prescribed.targetPaceRange).toEqual({ minSecPerKm: 280, maxSecPerKm: 295 });
  });

  it('lê blocks legados pelas keys reais (distance/duration)', () => {
    const blocks = [
      { type: 'warmup', duration: 10 },
      { type: 'main', duration: 20, distance: 4, targetPace: '5:30-5:45/km' },
      { type: 'cooldown', duration: 5 },
    ];
    const prescribed = (service as any).summarizePrescribed({
      ...workoutWith([], blocks),
      segments: null,
    });
    expect(prescribed.expectedMainDurationMin).toBe(20);
    expect(prescribed.targetPaceRange).toEqual({ minSecPerKm: 330, maxSecPerKm: 345 });
  });

  it('tempo run dentro do prescrito: o aquecimento não vira "undershot"', () => {
    const prescribed = (service as any).summarizePrescribed(workoutWith(tempoRunTree));
    const analysis = (service as any).analyzeExecution(tempoSession(), prescribed, undefined);

    // Pace médio da sessão (~6:00) está fora da faixa 5:30–5:45, mas o bloco
    // principal (5:35) está dentro — o veredito deve refletir o bloco principal.
    expect(analysis.targetAdherence).toBe('within');
    expect(analysis.mainPace).toBeDefined();
    // E o warmup/cooldown não podem transformar o pacing em "erratic"/"fade".
    expect(analysis.pacingStrategy).toBe('even');
  });

  it('prescrição de tiros sem laps (route) fica unknown, sem acusar o atleta', () => {
    const prescribed = (service as any).summarizePrescribed(workoutWith(intervalTree));
    const analysis = (service as any).analyzeExecution(tempoSession(), prescribed, undefined);

    expect(analysis.targetAdherence).toBe('unknown');
    const joined = analysis.observations.join(' ');
    expect(joined).toContain('não é possível verificar');
    expect(joined).not.toContain('Nenhum tiro detectado');
  });
});

describe('flattenToLegacyBlocks — targetPace', () => {
  it('preserva a faixa min–max em vez de achatar para a média dos mins', () => {
    const blocks = flattenToLegacyBlocks(tempoRunTree);
    const main = blocks.find((b) => b.type === 'main');
    expect(main?.targetPace).toBe('5:30-5:45/km');
  });
});
