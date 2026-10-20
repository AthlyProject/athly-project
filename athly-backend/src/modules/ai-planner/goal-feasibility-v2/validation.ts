import type { RunTarget, Segment } from '../../workouts/types/segment.types';
import { calculateVdot } from '../../effort-zones/vdot-calculator';
import {
  civilAge,
  EPSILON,
  finite,
  InputError,
  integer,
  localDate,
  oneOf,
  requireInput,
  stableHash,
} from './core';
import type { LocalDate } from './core';
import type { FrozenPrescription } from './prescription';
import type { Effort } from './objective';

export type WorkoutCandidate = {
  date: LocalDate;
  sport: 'RUNNING';
  segments: Segment[];
  isGoalAttempt?: boolean;
  title?: string;
  description?: string;
};
export type ValidatedWorkout = {
  date: LocalDate;
  sport: 'RUNNING';
  segments: Segment[];
  isGoalAttempt: boolean;
  title: string;
  description: string;
  maximumSeconds: number;
  maximumRunMeters: number | null;
};
type ExpandedLeaf = {
  segment: Segment;
  target: RunTarget;
  running: boolean;
  seconds: number;
  meters: number;
  fastestSeconds: number;
};

function knownKeys(value: object, keys: string[]): void {
  requireInput(
    Object.keys(value).every((k) => keys.includes(k)),
    'INVALID_STRUCTURE',
  );
}
function runTarget(target: Segment['target']): RunTarget {
  requireInput(
    target !== undefined && target !== null && typeof target === 'object',
    'INVALID_TARGET',
  );
  knownKeys(target, [
    'paceSecPerKmMin',
    'paceSecPerKmMax',
    'hrZone',
    'rpe',
    'hrMinBpm',
    'hrMaxBpm',
    'hrIsEstimated',
  ]);
  // Narrow the existing target union by its keys rather than hiding it behind a cast.
  const result: RunTarget = {};
  for (const key of [
    'paceSecPerKmMin',
    'paceSecPerKmMax',
    'hrZone',
    'rpe',
    'hrMinBpm',
    'hrMaxBpm',
  ] as const)
    if (key in target) {
      const value: unknown = target[key];
      requireInput(
        typeof value === 'number' && Number.isFinite(value) && value > 0,
        'INVALID_TARGET',
      );
      if (key === 'hrZone') {
        const zone = ([1, 2, 3, 4, 5] as const).find((z) => z === value);
        requireInput(zone !== undefined, 'INVALID_TARGET');
        result.hrZone = zone;
      } else result[key] = value;
    }
  if ('hrIsEstimated' in target) {
    requireInput(typeof target.hrIsEstimated === 'boolean');
    result.hrIsEstimated = target.hrIsEstimated;
  }
  if (result.rpe !== undefined) integer(result.rpe, 1, 10);
  if (result.hrMinBpm !== undefined && result.hrMaxBpm !== undefined)
    requireInput(result.hrMinBpm <= result.hrMaxBpm);
  return result;
}

export function expandSegments(segments: readonly Segment[]): Segment[] {
  requireInput(Array.isArray(segments), 'INVALID_STRUCTURE');
  const leaves: Segment[] = [];
  const ancestors = new Set<Segment>();
  const walk = (nodes: readonly Segment[], depth: number) => {
    requireInput(depth <= 32 && nodes.length <= 512, 'SEGMENT_LIMIT');
    for (const node of nodes) {
      requireInput(
        node !== null && typeof node === 'object' && !ancestors.has(node),
        'INVALID_STRUCTURE',
      );
      knownKeys(node, [
        'id',
        'kind',
        'label',
        'cue',
        'end',
        'repetitions',
        'target',
        'children',
        'notes',
      ]);
      requireInput(typeof node.id === 'string' && node.id.length > 0, 'INVALID_STRUCTURE');
      oneOf(node.kind, ['warmup', 'work', 'recovery', 'cooldown', 'rest', 'set']);
      if (node.kind === 'set') {
        requireInput(
          node.end === undefined &&
            node.target === undefined &&
            Array.isArray(node.children) &&
            node.children.length > 0,
          'INVALID_STRUCTURE',
        );
        integer(node.repetitions!, 1, 512);
        ancestors.add(node);
        for (let i = 0; i < node.repetitions!; i++) walk(node.children, depth + 1);
        ancestors.delete(node);
      } else {
        requireInput(
          node.children === undefined &&
            node.repetitions === undefined &&
            node.end !== undefined &&
            node.end !== null &&
            typeof node.end === 'object',
          'INVALID_STRUCTURE',
        );
        knownKeys(node.end, ['by', 'value']);
        oneOf(node.end.by, ['durationSec', 'distanceM']);
        requireInput(finite(node.end.value) > 0, 'INVALID_STRUCTURE');
        if (node.end.by === 'durationSec') integer(node.end.value, 1);
        leaves.push(node);
        requireInput(leaves.length <= 512, 'SEGMENT_LIMIT');
      }
    }
  };
  walk(segments, 0);
  return leaves;
}

/** Minimum time for any D-meter running window, including actual intervening walking/rest. */
export function fastestRunningWindow(
  parts: readonly { meters: number; fastestSeconds: number }[],
  distance: number,
): number | null {
  requireInput(finite(distance) > 0);
  let total = 0;
  const boundaries = [0];
  for (const part of parts) {
    requireInput(part.meters >= 0 && part.fastestSeconds >= 0);
    total += part.meters;
    boundaries.push(total);
  }
  if (total + EPSILON < distance) return null;
  const end = Math.max(0, total - distance);
  const starts = [
    ...new Set([0, end, ...boundaries, ...boundaries.map((b) => b - distance)]),
  ].filter((x) => x >= 0 && x <= end);
  const timeAt = (position: number, start: boolean): number => {
    let meters = 0;
    let seconds = 0;
    for (const part of parts) {
      if (part.meters === 0) {
        if (meters < position || (start && meters === position)) seconds += part.fastestSeconds;
        continue;
      }
      if (position < meters + part.meters || (!start && position === meters + part.meters))
        return seconds + ((position - meters) * part.fastestSeconds) / part.meters;
      meters += part.meters;
      seconds += part.fastestSeconds;
    }
    return seconds;
  };
  return Math.min(...starts.map((x) => timeAt(x + distance, false) - timeAt(x, true)));
}

function checkContinuous(leaves: ExpandedLeaf[], frozen: FrozenPrescription): void {
  const efforts = frozen.objective.efforts
    .filter((e) => {
      const age = civilAge(
        localDate(e.startDate, frozen.objective.timeZone),
        frozen.objective.asOf,
        frozen.objective.timeZone,
      );
      return age >= 0 && age <= 42;
    })
    .sort((a, b) => b.index - a.index);
  const stretches: ExpandedLeaf[][] = [];
  let current: ExpandedLeaf[] = [];
  for (const leaf of leaves) {
    if (leaf.running) current.push(leaf);
    else if (current.length) {
      stretches.push(current);
      current = [];
    }
  }
  if (current.length) stretches.push(current);
  for (const stretch of stretches) {
    const distances = [0];
    const times = [0];
    for (const leaf of stretch) {
      distances.push(distances.at(-1)! + leaf.meters);
      times.push(times.at(-1)! + leaf.fastestSeconds);
    }
    // For any fixed distance, the fastest window starts or ends at a pace boundary:
    // between boundaries its time is affine in the start position. Enumerate both
    // families, including partial end blocks, rather than sampling a few distances.
    for (let i = 0; i < stretch.length; i++) {
      for (let j = i; j < stretch.length; j++) {
        const fullDistance = distances[j + 1] - distances[i];
        if (fullDistance < 1500) continue;
        const fullTime = times[j + 1] - times[i];
        const endSlope = stretch[j].fastestSeconds / stretch[j].meters;
        certifyLinearWindows(
          efforts,
          Math.max(1500, distances[j] - distances[i]),
          fullDistance,
          endSlope,
          times[j] - times[i] - endSlope * (distances[j] - distances[i]),
        );
        const startSlope = stretch[i].fastestSeconds / stretch[i].meters;
        certifyLinearWindows(
          efforts,
          Math.max(1500, distances[j + 1] - distances[i + 1]),
          fullDistance,
          startSlope,
          fullTime - startSlope * fullDistance,
        );
      }
    }
  }
}

function certifyLinearWindows(
  efforts: readonly Effort[],
  from: number,
  through: number,
  slope: number,
  intercept: number,
): void {
  const cuts = [
    ...new Set([
      from,
      through,
      ...efforts.map((e) => 2.2 * e.distanceMeters).filter((d) => d > from && d < through),
    ]),
  ].sort((a, b) => a - b);
  if (cuts.length === 1) cuts.push(through);
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = cuts[i];
    const hi = cuts[i + 1];
    const observed = efforts.find((e) => e.distanceMeters >= Math.max(1500, (lo + hi) / 2 / 2.2));
    requireInput(observed !== undefined, 'CONTINUOUS_INDEX_EXCEEDED');
    const stack: Array<[number, number]> = [[lo, hi]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      const ta = slope * a + intercept;
      const tb = slope * b + intercept;
      requireInput(ta > 0 && tb > 0, 'INVALID_STRUCTURE');
      requireInput(
        Math.max(calculateVdot(a, ta), calculateVdot(b, tb)) <= observed.index + EPSILON,
        'CONTINUOUS_INDEX_EXCEEDED',
      );
      // Constant velocity makes E monotone in duration, so its endpoint maximum is exact.
      if (intercept === 0 || a === b) continue;
      // E increases with distance and decreases with duration. This enclosing upper
      // bound certifies the whole affine interval; subdivision is numerical, not a
      // physiological margin or a sampling heuristic.
      if (calculateVdot(b, ta) <= observed.index + EPSILON) continue;
      const mid = (a + b) / 2;
      requireInput(mid > a && mid < b, 'NUMERICAL_BOUND_UNRESOLVED');
      stack.push([a, mid], [mid, b]);
    }
  }
}

function paceLeaf(leaf: Segment, frozen: FrozenPrescription): ExpandedLeaf {
  const target = runTarget(leaf.target);
  const label = leaf.label;
  requireInput(
    label !== undefined &&
      ['Correr', 'Correr leve', 'Correr/caminhar', 'Caminhar', 'Descansar'].includes(label),
    'MODALITY_REQUIRED',
  );
  const running = !['Caminhar', 'Descansar'].includes(label);
  requireInput(leaf.kind !== 'rest' || !running, 'INVALID_STRUCTURE');
  const maxRpe = frozen.prescription.controlBounds?.maxRpe;
  if (maxRpe !== null && maxRpe !== undefined)
    requireInput(target.rpe !== undefined && target.rpe <= maxRpe, 'RPE_LIMIT');
  if (!running) {
    requireInput(
      leaf.end!.by === 'durationSec' &&
        target.paceSecPerKmMin === undefined &&
        target.paceSecPerKmMax === undefined &&
        target.rpe !== undefined &&
        target.rpe <= 3,
      'INVALID_WALK_TARGET',
    );
    return {
      segment: leaf,
      target,
      running,
      seconds: leaf.end!.value,
      meters: 0,
      fastestSeconds: leaf.end!.value,
    };
  }
  const min = target.paceSecPerKmMin;
  const max = target.paceSecPerKmMax;
  requireInput(min !== undefined && max !== undefined && min <= max, 'PACE_RANGE_REQUIRED');
  const zones = frozen.paceContext.zones;
  requireInput(zones !== null && frozen.prescription.strategy === 'evidence_pace');
  requireInput(
    min >= (frozen.prescription.intensity === 'easy' ? zones.easyPaceMin : zones.repetitionPaceMin),
    'PACE_TOO_FAST',
  );
  const meters = leaf.end!.by === 'distanceM' ? leaf.end!.value : (1000 * leaf.end!.value) / min;
  const seconds = leaf.end!.by === 'durationSec' ? leaf.end!.value : (leaf.end!.value * max) / 1000;
  const fastestSeconds =
    leaf.end!.by === 'durationSec' ? leaf.end!.value : (leaf.end!.value * min) / 1000;
  return { segment: leaf, target, running, seconds, meters, fastestSeconds };
}

function derivedPaceTree(nodes: Segment[]): Segment[] {
  return nodes.map((node) => {
    if (node.kind === 'set')
      return {
        id: node.id,
        kind: 'set',
        repetitions: node.repetitions,
        children: derivedPaceTree(node.children!),
      };
    const target = runTarget(node.target);
    const cue = [
      target.rpe !== undefined ? `RPE <= ${target.rpe}` : null,
      target.paceSecPerKmMin !== undefined
        ? `Pace ${target.paceSecPerKmMin}-${target.paceSecPerKmMax} s/km`
        : null,
      target.hrZone !== undefined ? `FC Z${target.hrZone}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join('; ');
    return {
      id: node.id,
      kind: node.kind,
      label: node.label,
      cue,
      end: structuredClone(node.end),
      target,
    };
  });
}

/** Validate the final executable representation; all free-form descriptive text is replaced. */
export function validateFinalWeek(
  frozen: FrozenPrescription,
  candidates: readonly WorkoutCandidate[],
): ValidatedWorkout[] {
  const { id, snapshotHash, ...snapshot } = frozen;
  requireInput(stableHash(snapshot) === snapshotHash && id === snapshotHash, 'SNAPSHOT_CHANGED');
  const prescription = frozen.prescription;
  requireInput(
    candidates.length <= (prescription.bounds?.maxSessionsPerWeek ?? 0),
    'SESSION_COUNT_LIMIT',
  );
  requireInput(new Set(candidates.map((w) => w.date)).size === candidates.length, 'DUPLICATE_DATE');
  if (prescription.delivery !== 'ready')
    requireInput(candidates.length === 0, 'DELIVERY_HAS_NO_SESSIONS');
  let weekSeconds = 0;
  let weekMeters = 0;
  const output: ValidatedWorkout[] = [];
  for (const workout of candidates) {
    requireInput(workout.sport === 'RUNNING', 'INVALID_MODALITY');
    const budget = prescription.sessions.find((s) => s.date === workout.date);
    requireInput(budget !== undefined, 'DATE_NOT_AUTHORIZED');
    const leaves = expandSegments(workout.segments);
    requireInput(leaves.length > 0, 'EMPTY_WORKOUT');
    let maximumSeconds = 0;
    let maximumRunMeters: number | null = null;
    let segments: Segment[];
    let attempt = false;
    if (prescription.strategy === 'entry' || prescription.strategy === 'duration_rpe') {
      const expected = frozen.expectedTrees.find((t) => t.date === workout.date);
      requireInput(
        expected !== undefined && stableHash(workout.segments) === stableHash(expected.segments),
        'DURATION_TEMPLATE_CHANGED',
      );
      requireInput(workout.isGoalAttempt !== true, 'ATTEMPT_FORBIDDEN');
      maximumSeconds = leaves.reduce((s, l) => s + l.end!.value, 0);
      requireInput(maximumSeconds <= budget.durationSeconds, 'SESSION_TIME_LIMIT');
      segments = structuredClone(expected.segments);
    } else {
      requireInput(prescription.strategy === 'evidence_pace', 'STRATEGY_HAS_NO_WORKOUT');
      const limit = frozen.paceDates.find((d) => d.date === workout.date);
      requireInput(limit !== undefined, 'DATE_NOT_AUTHORIZED');
      const expanded = leaves.map((l) => paceLeaf(l, frozen));
      maximumSeconds = expanded.reduce((s, l) => s + l.seconds, 0);
      maximumRunMeters = expanded.reduce((s, l) => s + l.meters, 0);
      requireInput(
        maximumSeconds <= Math.min(limit.maxSessionSeconds, budget.durationSeconds) + EPSILON,
        'SESSION_TIME_LIMIT',
      );
      requireInput(maximumRunMeters <= limit.maxSessionMeters + EPSILON, 'SESSION_DISTANCE_LIMIT');
      if (frozen.assessment.endurance.state !== 'supported')
        requireInput(
          maximumRunMeters + EPSILON < frozen.target.distanceMeters!,
          'UNSUPPORTED_GOAL_DISTANCE',
        );
      if (
        frozen.target.timeSeconds !== null &&
        frozen.assessment.performance.state !== 'supported'
      ) {
        const fastest = fastestRunningWindow(expanded, frozen.target.distanceMeters!);
        requireInput(
          fastest === null || fastest > frozen.target.timeSeconds + EPSILON,
          'UNSUPPORTED_GOAL_TIME',
        );
      }
      checkContinuous(expanded, frozen);
      requireInput(
        workout.isGoalAttempt !== true || (limit.attemptEligible && prescription.attemptEligible),
        'ATTEMPT_FORBIDDEN',
      );
      // Unsupported D and D/T have already been checked independently of the flag. A supported
      // ordinary training session can exceed a short goal distance within its ordinary limits.
      attempt =
        workout.isGoalAttempt === true ||
        (limit.attemptEligible && maximumRunMeters + EPSILON >= frozen.target.distanceMeters!);
      segments = derivedPaceTree(workout.segments);
      weekMeters += maximumRunMeters;
    }
    weekSeconds += maximumSeconds;
    const description = expandSegments(segments)
      .map(
        (s) => `${s.label}: ${s.end!.value} ${s.end!.by === 'durationSec' ? 's' : 'm'}; ${s.cue}`,
      )
      .join('. ');
    output.push({
      date: workout.date,
      sport: 'RUNNING',
      segments,
      isGoalAttempt: attempt,
      title:
        prescription.strategy === 'entry'
          ? 'Caminhar e correr leve'
          : prescription.strategy === 'duration_rpe'
            ? 'Correr/caminhar por RPE'
            : 'Corrida',
      description,
      maximumSeconds,
      maximumRunMeters,
    });
  }
  if (prescription.strategy === 'entry' || prescription.strategy === 'duration_rpe')
    requireInput(candidates.length === frozen.expectedTrees.length, 'DURATION_SCHEDULE_CHANGED');
  requireInput(
    weekSeconds <= (prescription.bounds?.maxWeekSeconds ?? 0) + EPSILON,
    'WEEK_TIME_LIMIT',
  );
  if (prescription.bounds?.kind === 'evidence')
    requireInput(weekMeters <= prescription.bounds.maxWeekMeters + EPSILON, 'WEEK_DISTANCE_LIMIT');
  if (prescription.controlBounds)
    requireInput(
      weekSeconds <= prescription.controlBounds.maxWeekSeconds + EPSILON,
      'CONTROL_TIME_LIMIT',
    );
  return output;
}

/** Duration fallback is exactly the approved tree. Pace fallback must be supplied and pass the same validator. */
export function validatedFallback(
  frozen: FrozenPrescription,
  paceFallback: WorkoutCandidate[] = [],
): ValidatedWorkout[] {
  const candidates =
    frozen.prescription.strategy === 'entry' || frozen.prescription.strategy === 'duration_rpe'
      ? frozen.expectedTrees.map(
          (t): WorkoutCandidate => ({
            date: t.date,
            sport: 'RUNNING',
            segments: t.segments,
            isGoalAttempt: false,
          }),
        )
      : paceFallback;
  return validateFinalWeek(frozen, candidates);
}

/** At most three supplied generation attempts; fallback uses exactly the same frozen validator. */
export function validateAttempts(
  frozen: FrozenPrescription,
  attempts: readonly WorkoutCandidate[][],
  paceFallback: WorkoutCandidate[] = [],
): {
  workouts: ValidatedWorkout[];
  source: 'attempt' | 'fallback';
  attemptsUsed: number;
  rejectedCodes: string[];
} {
  integer(attempts.length, 0, 3);
  const rejectedCodes: string[] = [];
  for (let i = 0; i < attempts.length; i++) {
    try {
      return {
        workouts: validateFinalWeek(frozen, attempts[i]),
        source: 'attempt',
        attemptsUsed: i + 1,
        rejectedCodes,
      };
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      rejectedCodes.push(error.code);
    }
  }
  return {
    workouts: validatedFallback(frozen, paceFallback),
    source: 'fallback',
    attemptsUsed: attempts.length,
    rejectedCodes,
  };
}
