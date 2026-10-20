import type { RunTarget, Segment } from '../../workouts/types/segment.types';
import { integer, requireInput } from './core';

/** C is a ceiling, whereas this function returns the dose Q(C) that the entry tree emits. */
export function entryDoseSeconds(ceiling: number): number {
  integer(ceiling, 0, 1200);
  return ceiling < 600 ? ceiling : 480 + 120 * Math.min(6, Math.floor((ceiling - 480) / 120));
}
function leaf(
  id: string,
  kind: Segment['kind'],
  label: string,
  seconds: number,
  rpe: 3 | 4,
  hrZone?: 1 | 2,
): Segment {
  const target: RunTarget = hrZone === undefined ? { rpe } : { rpe, hrZone };
  return {
    id,
    kind,
    label,
    cue: `RPE <= ${rpe}`,
    end: { by: 'durationSec', value: seconds },
    target,
  };
}
export function entryTree(ceiling: number, runRpe: 3 | 4): Segment[] {
  integer(ceiling, 0, 1200);
  requireInput(runRpe === 3 || runRpe === 4);
  if (ceiling === 0) return [];
  if (ceiling < 600) return [leaf('assessment-walk', 'work', 'Caminhar', ceiling, 3)];
  const k = Math.min(6, Math.floor((ceiling - 480) / 120));
  return [
    leaf('assessment-warmup', 'warmup', 'Caminhar', 240, 3),
    {
      id: 'assessment-set',
      kind: 'set',
      repetitions: k,
      children: [
        leaf('assessment-run', 'work', 'Correr leve', 30, runRpe),
        leaf('assessment-walk', 'recovery', 'Caminhar', 90, 3),
      ],
    },
    leaf('assessment-cooldown', 'cooldown', 'Caminhar', 240, 3),
  ];
}
export function durationTree(seconds: number, mainRpe: 3 | 4, useHeartRate = false): Segment[] {
  integer(seconds, 0, 5400);
  requireInput(seconds % 30 === 0 && (mainRpe === 3 || mainRpe === 4));
  if (seconds === 0) return [];
  const walkZone = useHeartRate ? 1 : undefined;
  if (seconds < 300) return [leaf('duration-walk', 'work', 'Caminhar', seconds, 3, walkZone)];
  const w = Math.min(180, 30 * Math.floor(seconds / 120));
  const main = leaf(
    'duration-main',
    'work',
    'Correr/caminhar',
    seconds - 2 * w,
    mainRpe,
    useHeartRate ? (mainRpe === 3 ? 1 : 2) : undefined,
  );
  main.cue = `RPE <= ${mainRpe}; caminhe conforme precisar`;
  return [
    leaf('duration-warmup', 'warmup', 'Caminhar', w, 3, walkZone),
    main,
    leaf('duration-cooldown', 'cooldown', 'Caminhar', w, 3, walkZone),
  ];
}
export function durationRunSeconds(seconds: number): number {
  integer(seconds);
  return seconds < 300 ? 0 : seconds - 2 * Math.min(180, 30 * Math.floor(seconds / 120));
}
export function entryRunSeconds(ceiling: number): number {
  integer(ceiling, 0, 1200);
  return ceiling < 600 ? 0 : 30 * Math.min(6, Math.floor((ceiling - 480) / 120));
}
