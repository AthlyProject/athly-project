import { WorkoutBlock } from '../models/workout.model';
import { EndCondition, RunTarget, Segment } from '../types/segment.types';

interface LegacyAccumulator {
  distanceM: number;
  durationSec: number;
  paceSecPerKmMinHints: number[];
  paceSecPerKmMaxHints: number[];
  prose: string[];
}

const formatPace = (secPerKm: number): string => {
  const totalSec = Math.round(secPerKm);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const isRunTarget = (t: Segment['target']): t is RunTarget => {
  if (!t || typeof t !== 'object') return false;
  return 'paceSecPerKmMin' in t || 'paceSecPerKmMax' in t || 'hrZone' in t || 'rpe' in t;
};

const formatEnd = (end: EndCondition | undefined): string => {
  if (!end) return '';
  if (end.by === 'distanceM') {
    return end.value >= 1000
      ? `${(end.value / 1000).toFixed(end.value % 1000 === 0 ? 0 : 2)}km`
      : `${end.value}m`;
  }
  if (end.by === 'durationSec') {
    if (end.value >= 60 && end.value % 60 === 0) return `${end.value / 60}min`;
    return `${end.value}s`;
  }
  return `${end.value} reps`;
};

const describeSegment = (s: Segment): string => {
  const target = isRunTarget(s.target)
    ? s.target.paceSecPerKmMin
      ? ` @ pace ${formatPace(s.target.paceSecPerKmMin)}${
          s.target.paceSecPerKmMax ? `-${formatPace(s.target.paceSecPerKmMax)}` : ''
        }/km`
      : s.target.rpe
        ? ` (RPE ${s.target.rpe})`
        : ''
    : '';
  const end = formatEnd(s.end);
  if (s.kind === 'recovery') return `recovery ${end}${target}`;
  if (s.kind === 'rest') return `descanso ${end}`;
  return `${end}${target}`.trim();
};

const accumulate = (seg: Segment, mult: number, acc: LegacyAccumulator): void => {
  if (seg.kind === 'set' && seg.children) {
    const reps = seg.repetitions ?? 1;
    const childrenSummary = seg.children.map(describeSegment).filter(Boolean).join(' + ');
    if (childrenSummary) acc.prose.push(`${reps}× (${childrenSummary})`);
    for (const child of seg.children) {
      accumulate(child, mult * reps, acc);
    }
    return;
  }

  if (seg.end?.by === 'distanceM') acc.distanceM += seg.end.value * mult;
  if (seg.end?.by === 'durationSec') acc.durationSec += seg.end.value * mult;

  if (isRunTarget(seg.target)) {
    if (seg.target.paceSecPerKmMin) acc.paceSecPerKmMinHints.push(seg.target.paceSecPerKmMin);
    if (seg.target.paceSecPerKmMax) acc.paceSecPerKmMaxHints.push(seg.target.paceSecPerKmMax);
  }
};

const summaryBlock = (
  type: 'warmup' | 'main' | 'cooldown',
  segments: Segment[],
  fallbackProse?: string,
): WorkoutBlock | null => {
  if (segments.length === 0) return null;
  const acc: LegacyAccumulator = {
    distanceM: 0,
    durationSec: 0,
    paceSecPerKmMinHints: [],
    paceSecPerKmMaxHints: [],
    prose: [],
  };
  for (const s of segments) accumulate(s, 1, acc);

  const block: WorkoutBlock = { type };
  if (acc.distanceM > 0) block.distance = +(acc.distanceM / 1000).toFixed(2);
  if (acc.durationSec > 0) block.duration = Math.round(acc.durationSec / 60);
  // Faixa real prescrita: limite rápido = menor min, limite lento = maior max.
  // Achatar para a média dos mins escondia o teto da faixa e fazia o analisador
  // julgar como "lento" um treino executado dentro do prescrito.
  const allHints = [...acc.paceSecPerKmMinHints, ...acc.paceSecPerKmMaxHints];
  if (allHints.length > 0) {
    const lo = Math.min(...allHints);
    const hi = Math.max(...allHints);
    block.targetPace =
      lo === hi ? `${formatPace(lo)}/km` : `${formatPace(lo)}-${formatPace(hi)}/km`;
  }
  const proseParts = [...acc.prose];
  if (fallbackProse) proseParts.push(fallbackProse);
  if (proseParts.length > 0) block.instructions = proseParts.join('; ');
  return block;
};

export const flattenToLegacyBlocks = (segments: Segment[]): WorkoutBlock[] => {
  const warmup: Segment[] = [];
  const main: Segment[] = [];
  const cooldown: Segment[] = [];

  for (const s of segments) {
    if (s.kind === 'warmup') warmup.push(s);
    else if (s.kind === 'cooldown') cooldown.push(s);
    else main.push(s);
  }

  const blocks: WorkoutBlock[] = [];
  const w = summaryBlock('warmup', warmup);
  const m = summaryBlock('main', main);
  const c = summaryBlock('cooldown', cooldown);
  if (w) blocks.push(w);
  if (m) blocks.push(m);
  if (c) blocks.push(c);
  return blocks;
};
