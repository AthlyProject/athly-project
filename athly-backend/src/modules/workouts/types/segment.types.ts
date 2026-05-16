import { SportType } from '@prisma/client';

export const SEGMENT_SCHEMA_VERSION = 1 as const;

export type SegmentKind =
  | 'warmup'
  | 'work'
  | 'recovery'
  | 'cooldown'
  | 'rest'
  | 'set';

export type EndBy = 'distanceM' | 'durationSec' | 'reps';

export interface EndCondition {
  by: EndBy;
  value: number;
}

export interface RunTarget {
  paceSecPerKmMin?: number;
  paceSecPerKmMax?: number;
  hrZone?: 1 | 2 | 3 | 4 | 5;
  rpe?: number;
}

export interface CycleTarget {
  powerWattsMin?: number;
  powerWattsMax?: number;
  cadenceRpm?: number;
  hrZone?: 1 | 2 | 3 | 4 | 5;
}

export type SwimStroke =
  | 'freestyle'
  | 'backstroke'
  | 'breaststroke'
  | 'butterfly'
  | 'medley'
  | 'kick'
  | 'drill';

export interface SwimTarget {
  strokeType?: SwimStroke;
  poolLengthM?: 25 | 50;
  targetSecPer100m?: number;
}

export interface StrengthTarget {
  exercise: string;
  reps?: number;
  loadKg?: number;
  loadPctOf1RM?: number;
  tempoSec?: string;
  restAfterSec?: number;
}

export type SegmentTarget =
  | RunTarget
  | CycleTarget
  | SwimTarget
  | StrengthTarget;

export interface Segment {
  id: string;
  kind: SegmentKind;
  label?: string;
  cue?: string;
  end?: EndCondition;
  repetitions?: number;
  target?: SegmentTarget;
  children?: Segment[];
  notes?: string;
}

export interface WorkoutSegments {
  schemaVersion: typeof SEGMENT_SCHEMA_VERSION;
  sport: SportType;
  segments: Segment[];
}
