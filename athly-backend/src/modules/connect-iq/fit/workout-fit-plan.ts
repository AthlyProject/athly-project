import { createHash } from 'node:crypto';
import type { RunTarget, Segment, SegmentKind } from '../../workouts/types/segment.types';
import { extractSegmentTree } from '../../workouts/utils/extract-segment-tree';
import { paceRangeOf } from '../../workouts/utils/pace-range';
import { validateSegmentTree } from '../../workouts/utils/validate-segments';
import {
  ENCODER_VERSION,
  MAX_FIT_STEPS,
  MAX_NOTES_LENGTH,
  MAX_PACE_SEC_PER_KM,
  MAX_STEP_NAME_LENGTH,
  MAX_WORKOUT_NAME_LENGTH,
  MIN_PACE_SEC_PER_KM,
  RECOVERY_INTENSITY,
  SINGLE_PACE_PAD_SEC,
} from './fit.constants';
import { sanitizeFitText } from './fit-text';

type LeafKind = Exclude<SegmentKind, 'set'>;

export type FitIntensity = 'active' | 'rest' | 'warmup' | 'cooldown' | 'recovery';

/** Um `workout_step` FIT só com os campos principais (o encoder ignora subcampos). */
export interface FitWorkoutStep {
  wktStepName?: string;
  notes?: string;
  intensity?: FitIntensity;
  durationType: 'time' | 'distance' | 'open' | 'repeatUntilStepsCmplt';
  /** time: ms · distance: cm · repeat: messageIndex do primeiro passo repetido. */
  durationValue?: number;
  targetType?: 'speed' | 'heartRate' | 'open';
  /** heartRate: zona 1–5 · speed custom: 0 · repeat: número de repetições. */
  targetValue?: number;
  /** Velocidade em mm/s; `Low` é o limite lento. */
  customTargetValueLow?: number;
  customTargetValueHigh?: number;
}

export interface FitWorkoutPlan {
  name: string;
  steps: FitWorkoutStep[];
  /** Muda sempre que o FIT gerado mudaria — o relógio troca o treino quando o `rev` muda. */
  rev: string;
}

export interface FitWorkoutSource {
  id: string;
  title: string;
  dateScheduled: Date;
  sportType: string;
  segments: unknown;
}

export type FitSkipReason =
  | 'unsupported_sport'
  | 'no_segments'
  | 'invalid_segments'
  | 'empty'
  | 'too_many_steps';

export type FitPlanResult =
  | { ok: true; plan: FitWorkoutPlan }
  | { ok: false; reason: FitSkipReason };

/** Mesmos rótulos padrão do iOS (`ActiveSegment.defaultLabel`) para segmentos sem `label`. */
const DEFAULT_LABELS: Record<LeafKind, string> = {
  warmup: 'Aquecimento',
  work: 'Tiro',
  recovery: 'Recuperação',
  cooldown: 'Desaceleramento',
  rest: 'Descanso',
};

const INTENSITY: Record<LeafKind, FitIntensity> = {
  warmup: 'warmup',
  work: 'active',
  recovery: RECOVERY_INTENSITY,
  cooldown: 'cooldown',
  rest: 'rest',
};

const isLeafKind = (kind: unknown): kind is LeafKind =>
  typeof kind === 'string' && kind in INTENSITY;

const isPlausiblePace = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= MIN_PACE_SEC_PER_KM &&
  value <= MAX_PACE_SEC_PER_KM;

/** s/km → mm/s, a unidade de `custom_target_value_*` para alvo de velocidade. */
const speedMmPerSec = (secPerKm: number): number => Math.round(1_000_000 / secPerKm);

const durationOf = (
  end: Segment['end'],
): Pick<FitWorkoutStep, 'durationType' | 'durationValue'> | null => {
  // Repetições (força) não têm duração no relógio: o atleta fecha o passo com o botão de volta.
  if (!end || end.by === 'reps') return { durationType: 'open' };
  const value = Number(end.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (end.by === 'durationSec') {
    return { durationType: 'time', durationValue: Math.round(value * 1000) };
  }
  if (end.by === 'distanceM') {
    return { durationType: 'distance', durationValue: Math.round(value * 100) };
  }
  return { durationType: 'open' };
};

const targetOf = (
  target: RunTarget | undefined,
): { fields: Partial<FitWorkoutStep>; notes: string[] } => {
  const notes: string[] = [];
  const zone =
    typeof target?.hrZone === 'number' && target.hrZone >= 1 && target.hrZone <= 5
      ? target.hrZone
      : undefined;
  if (typeof target?.rpe === 'number' && target.rpe > 0) notes.push(`RPE ${target.rpe}`);

  const pace = paceRangeOf(
    [target?.paceSecPerKmMin, target?.paceSecPerKmMax].filter(isPlausiblePace),
    SINGLE_PACE_PAD_SEC,
  );
  if (pace) {
    if (zone) notes.unshift(`Z${zone}`);
    return {
      fields: {
        targetType: 'speed',
        targetValue: 0,
        customTargetValueLow: speedMmPerSec(pace.maxSecPerKm),
        customTargetValueHigh: speedMmPerSec(pace.minSecPerKm),
      },
      notes,
    };
  }
  // Zona da Athly (1–5) vira a zona configurada no próprio relógio.
  if (zone) return { fields: { targetType: 'heartRate', targetValue: zone }, notes };
  return { fields: { targetType: 'open' }, notes };
};

const leafStep = (segment: Segment): FitWorkoutStep | null => {
  if (!isLeafKind(segment.kind)) return null;
  const duration = durationOf(segment.end);
  if (!duration) return null;
  const target = targetOf(segment.target as RunTarget | undefined);
  const notes = [segment.cue ?? segment.notes, ...target.notes].filter(Boolean).join(' · ');
  return {
    wktStepName:
      sanitizeFitText(segment.label || DEFAULT_LABELS[segment.kind], MAX_STEP_NAME_LENGTH) ||
      undefined,
    notes: sanitizeFitText(notes, MAX_NOTES_LENGTH) || undefined,
    intensity: INTENSITY[segment.kind],
    ...duration,
    ...target.fields,
  };
};

const emit = (segment: Segment, out: FitWorkoutStep[], depth: number): void => {
  if (segment.kind !== 'set') {
    const step = leafStep(segment);
    if (step) out.push(step);
    return;
  }
  const children = segment.children ?? [];
  const reps = Math.max(1, Math.floor(segment.repetitions ?? 1));
  if (depth > 0) {
    // Set dentro de set: desenrola. Só um nível de repetição é garantido nos relógios.
    for (let rep = 0; rep < reps; rep++) {
      for (const child of children) emit(child, out, depth + 1);
    }
    return;
  }
  const first = out.length;
  for (const child of children) emit(child, out, depth + 1);
  if (reps >= 2 && out.length > first) {
    out.push({ durationType: 'repeatUntilStepsCmplt', durationValue: first, targetValue: reps });
  }
};

/** Nome do treino no relógio: `DD/MM título` — a data ordena a lista nativa e evita repetição. */
export function fitWorkoutName(title: string, dateScheduled: Date): string {
  const day = String(dateScheduled.getUTCDate()).padStart(2, '0');
  const month = String(dateScheduled.getUTCMonth() + 1).padStart(2, '0');
  return sanitizeFitText(`${day}/${month} ${title}`, MAX_WORKOUT_NAME_LENGTH);
}

export function fitPlanRevision(name: string, steps: FitWorkoutStep[]): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: ENCODER_VERSION, sport: 'running', name, steps }))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Converte um treino planejado (árvore `segments`) nos passos de um treino FIT nativo da Garmin.
 * Treinos sem árvore válida, que não são corrida ou que passam do limite de passos ficam de fora.
 */
export function buildFitPlan(workout: FitWorkoutSource): FitPlanResult {
  if (workout.sportType !== 'running') return { ok: false, reason: 'unsupported_sport' };
  const tree = extractSegmentTree(workout.segments);
  if (!tree) return { ok: false, reason: 'no_segments' };
  if (!validateSegmentTree(tree).ok) return { ok: false, reason: 'invalid_segments' };

  const steps: FitWorkoutStep[] = [];
  for (const segment of tree as Segment[]) emit(segment, steps, 0);
  if (steps.length === 0) return { ok: false, reason: 'empty' };
  if (steps.length > MAX_FIT_STEPS) return { ok: false, reason: 'too_many_steps' };

  const name = fitWorkoutName(workout.title, workout.dateScheduled);
  return { ok: true, plan: { name, steps, rev: fitPlanRevision(name, steps) } };
}
