import { compareText } from './core';
import {
  calculateVdot,
  derivePaceZones,
  predictRaceTime,
} from '../../effort-zones/vdot-calculator';
import {
  addDays,
  agrees,
  civil,
  civilAge,
  daysBetween,
  ENGINE_VERSION,
  EPSILON,
  evaluationExpiresAt,
  finite,
  instant,
  integer,
  localDate,
  monday,
  oneOf,
  owned,
  requireInput,
  stableHash,
  startOfDate,
  timeZone,
  uniqueSorted,
} from './core';
import type { Instant, LocalDate } from './core';
import type { Confidence, DurationBasis, GoalSupport } from './types';

export type MeasurementSource = 'healthkit_workout' | 'manual' | 'prescribed' | 'unknown';
export type Provenance = 'recorded' | 'reported' | 'inferred' | 'unknown';
export type OffsetInterval = { startOffsetSeconds: number; endOffsetSeconds: number };
export type RunObservation = {
  schemaVersion: 1;
  measurementSource: MeasurementSource;
  sourceBundleIdentifier: string | null;
  userEntered: boolean | null;
  activityKind: 'running' | 'other' | 'unknown';
  distanceBasis: 'workout_total' | 'reported' | 'prescribed' | 'unknown';
  endDate: Instant | null;
  durationBasis: DurationBasis;
  pauses: { method: 'events' | 'not_checked'; intervals: OffsetInterval[] | null };
};
export type SegmentObservation = OffsetInterval & {
  durationBasis: DurationBasis;
  distanceSource: 'events' | 'route' | 'prescribed' | 'synthetic' | 'unknown';
};
export type EffortAssertion = {
  intent: 'unknown' | 'training' | 'maximal';
  continuity: 'unknown' | 'continuous' | 'interrupted';
  conditions: 'unknown' | 'comparable' | 'non_comparable';
  assertedAt: Instant;
};
export type ObjectiveRunInput = {
  userId: string;
  id: string;
  sourceId: string | null;
  sourceRevision: number;
  startDate: Instant | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  observation: RunObservation | null;
  assertion: EffortAssertion | null;
  linkedWorkout: { id: string; userId: string } | null;
  parentSourceId: string | null;
  withdrawn: boolean;
  segments: Array<{ id: string; distanceMeters: number; observation: SegmentObservation }>;
};
export type ReadState = 'complete' | 'empty' | 'partial' | 'failed' | 'unavailable';
export type HistoryCoverage = {
  schemaVersion: 1;
  state: ReadState;
  requestedFrom: Instant;
  requestedTo: Instant;
  coveredIntervals: Array<{ from: Instant; to: Instant }>;
  truncated: boolean;
  failureCode: 'protected_data' | 'query_failed' | 'cancelled' | 'unsupported' | null;
  assertion: null | {
    kind: 'all_runs_recorded' | 'no_running';
    from: Instant;
    to: Instant;
    assertedAt: Instant;
  };
};
export type ObjectiveCapture = {
  userId: string;
  capturedAt: Instant;
  coverage: HistoryCoverage;
  runs: ObjectiveRunInput[];
};
export type CaptureState = {
  userId: string;
  lastAttempt: ObjectiveCapture | null;
  useful: ObjectiveCapture | null;
};
export type ObjectiveReason = {
  code: string;
  evidenceIds: string[];
  facts: Array<{ name: string; value: number | string | boolean | null; unit: string | null }>;
};
export type NormalizedRun = {
  id: string;
  sourceId: string | null;
  sourceRevision: number;
  memberIds: string[];
  provenance: Provenance;
  measurementSource: MeasurementSource;
  sourceBundleIdentifier: string | null;
  userEntered: boolean | null;
  activityKind: RunObservation['activityKind'];
  distanceBasis: RunObservation['distanceBasis'];
  durationBasis: DurationBasis;
  durationSeconds: number | null;
  startDate: Instant | null;
  endDate: Instant | null;
  distanceMeters: number | null;
  elapsedSeconds: number | null;
  continuity: 'unknown' | 'interrupted';
  assertion: EffortAssertion | null;
  linkedWorkoutId: string | null;
  parentSourceId: string | null;
  segments: ObjectiveRunInput['segments'];
  volumeEligible: boolean;
  exposureEligible: boolean;
  quarantined: boolean;
  reasons: string[];
};
export type Effort = {
  id: string;
  runId: string;
  startDate: Instant;
  distanceMeters: number;
  elapsedSeconds: number;
  index: number;
};
export type ObjectiveEvidence = {
  userId: string;
  asOf: Instant;
  timeZone: string;
  capturedAt: Instant | null;
  lastReadState: ReadState | null;
  coverage: HistoryCoverage | null;
  runs: NormalizedRun[];
  efforts: Effort[];
  fresh: boolean;
  evidenceHash: string;
  conflicts: Array<{ code: string; evidenceIds: string[]; from: Instant; to: Instant }>;
};

function checkBasis(value: DurationBasis): void {
  oneOf(value, ['active', 'elapsed', 'unknown']);
}

export function validateCoverage(coverage: HistoryCoverage, capturedAt: Instant): void {
  requireInput(coverage.schemaVersion === 1 && typeof coverage.truncated === 'boolean');
  oneOf(coverage.state, ['complete', 'empty', 'partial', 'failed', 'unavailable']);
  requireInput(instant(coverage.requestedFrom) < instant(coverage.requestedTo));
  requireInput(instant(coverage.requestedTo) <= instant(capturedAt));
  coverage.coveredIntervals.forEach(({ from, to }) => {
    requireInput(instant(from) < instant(to) && instant(to) <= instant(capturedAt));
  });
  requireInput(!(coverage.truncated && ['complete', 'empty'].includes(coverage.state)));
  if (coverage.failureCode !== null)
    oneOf(coverage.failureCode, ['protected_data', 'query_failed', 'cancelled', 'unsupported']);
  if (coverage.assertion) {
    oneOf(coverage.assertion.kind, ['all_runs_recorded', 'no_running']);
    requireInput(instant(coverage.assertion.from) < instant(coverage.assertion.to));
    requireInput(instant(coverage.assertion.assertedAt) <= instant(capturedAt));
    requireInput(instant(coverage.assertion.to) <= instant(coverage.assertion.assertedAt));
  }
}

/** Failed/empty attempts keep the original useful capture and its original clock. */
export function mergeObjectiveCapture(
  state: CaptureState,
  incoming: ObjectiveCapture,
): CaptureState {
  owned(state.userId, [incoming, ...incoming.runs]);
  validateCoverage(incoming.coverage, incoming.capturedAt);
  if (state.lastAttempt) {
    const order = instant(incoming.capturedAt) - instant(state.lastAttempt.capturedAt);
    if (order < 0) return structuredClone(state);
    if (order === 0) {
      requireInput(stableHash(incoming) === stableHash(state.lastAttempt), 'CAPTURE_CONFLICT');
      return structuredClone(state);
    }
  }
  const useful =
    incoming.runs.length > 0 && ['complete', 'partial'].includes(incoming.coverage.state)
      ? incoming
      : state.useful;
  // Missing IDs are not deletions. Explicit tombstones and revisions alone remove facts.
  const merged =
    useful === incoming && state.useful
      ? { ...incoming, runs: [...state.useful.runs, ...incoming.runs] }
      : useful;
  return structuredClone({ userId: state.userId, lastAttempt: incoming, useful: merged });
}

export function unionOffsets(
  intervals: readonly OffsetInterval[],
  elapsedSeconds: number,
): OffsetInterval[] {
  const sorted = intervals
    .map((i) => {
      finite(i.startOffsetSeconds);
      finite(i.endOffsetSeconds);
      requireInput(
        i.startOffsetSeconds >= 0 &&
          i.startOffsetSeconds < i.endOffsetSeconds &&
          i.endOffsetSeconds <= elapsedSeconds + 0.001,
      );
      return { ...i, endOffsetSeconds: Math.min(i.endOffsetSeconds, elapsedSeconds) };
    })
    .sort((a, b) => a.startOffsetSeconds - b.startOffsetSeconds);
  const result: OffsetInterval[] = [];
  for (const interval of sorted) {
    const last = result.at(-1);
    if (last && interval.startOffsetSeconds <= last.endOffsetSeconds)
      last.endOffsetSeconds = Math.max(last.endOffsetSeconds, interval.endOffsetSeconds);
    else result.push(interval);
  }
  return result;
}

function normalizeRun(input: ObjectiveRunInput, asOf: Instant): NormalizedRun {
  requireInput(input.id.length > 0);
  integer(input.sourceRevision);
  if (input.linkedWorkout) owned(input.userId, [input.linkedWorkout]);
  if (input.distanceMeters !== null) finite(input.distanceMeters);
  if (input.durationSeconds !== null) finite(input.durationSeconds);
  if (input.startDate !== null) instant(input.startDate);
  const o = input.observation;
  if (o) {
    requireInput(
      typeof o === 'object' &&
        [
          'schemaVersion',
          'measurementSource',
          'sourceBundleIdentifier',
          'userEntered',
          'activityKind',
          'distanceBasis',
          'endDate',
          'durationBasis',
          'pauses',
        ].every((key) => key in o),
    );
    requireInput(o.pauses !== null && typeof o.pauses === 'object');
    requireInput(o.schemaVersion === 1);
    oneOf(o.measurementSource, ['healthkit_workout', 'manual', 'prescribed', 'unknown']);
    oneOf(o.activityKind, ['running', 'other', 'unknown']);
    oneOf(o.distanceBasis, ['workout_total', 'reported', 'prescribed', 'unknown']);
    checkBasis(o.durationBasis);
    requireInput(o.userEntered === null || typeof o.userEntered === 'boolean');
    requireInput(o.sourceBundleIdentifier === null || typeof o.sourceBundleIdentifier === 'string');
    oneOf(o.pauses.method, ['events', 'not_checked']);
    requireInput(
      o.pauses.method === 'not_checked'
        ? o.pauses.intervals === null
        : Array.isArray(o.pauses.intervals),
    );
    if (o.endDate) instant(o.endDate);
    if (o.measurementSource === 'healthkit_workout' && input.sourceId !== null)
      requireInput(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.sourceId),
      );
  }
  if (input.assertion) {
    oneOf(input.assertion.intent, ['unknown', 'training', 'maximal']);
    oneOf(input.assertion.continuity, ['unknown', 'continuous', 'interrupted']);
    oneOf(input.assertion.conditions, ['unknown', 'comparable', 'non_comparable']);
    requireInput(instant(input.assertion.assertedAt) <= instant(asOf));
  }
  let provenance: Provenance = 'unknown';
  if (
    o?.userEntered === true ||
    o?.measurementSource === 'manual' ||
    o?.distanceBasis === 'reported'
  )
    provenance = 'reported';
  else if (o?.measurementSource === 'prescribed' || o?.distanceBasis === 'prescribed')
    provenance = 'inferred';
  else if (
    o?.measurementSource === 'healthkit_workout' &&
    input.sourceId &&
    o.sourceBundleIdentifier &&
    o.activityKind === 'running' &&
    o.distanceBasis === 'workout_total'
  )
    provenance = 'recorded';
  const endDate = o?.endDate ?? null;
  const elapsed =
    input.startDate && endDate ? (instant(endDate) - instant(input.startDate)) / 1000 : null;
  const reasons: string[] = [];
  if (!input.startDate) reasons.push('EXECUTION_DATE_MISSING');
  if (input.startDate && instant(input.startDate) > instant(asOf)) reasons.push('FUTURE_EXECUTION');
  if (endDate && instant(endDate) > instant(asOf)) reasons.push('FUTURE_EXECUTION');
  if (elapsed !== null && elapsed <= 0) reasons.push('INVALID_EXECUTION_INTERVAL');
  if (input.durationSeconds !== null && input.durationSeconds <= 0)
    reasons.push('INVALID_DURATION');
  if (
    o?.durationBasis === 'active' &&
    elapsed !== null &&
    input.durationSeconds !== null &&
    input.durationSeconds > elapsed + 1
  )
    reasons.push('ACTIVE_EXCEEDS_ELAPSED');
  if (input.distanceMeters === null || input.distanceMeters <= 0)
    reasons.push('DISTANCE_MISSING_OR_NONPOSITIVE');
  if (provenance !== 'recorded') reasons.push('OBJECTIVE_ORIGIN_UNAVAILABLE');
  const temporalValid = !reasons.some((r) =>
    [
      'FUTURE_EXECUTION',
      'INVALID_EXECUTION_INTERVAL',
      'ACTIVE_EXCEEDS_ELAPSED',
      'EXECUTION_DATE_MISSING',
    ].includes(r),
  );
  const pauses = o?.pauses.intervals;
  if (pauses && pauses.length) requireInput(elapsed !== null && elapsed > 0);
  const union = elapsed !== null && elapsed > 0 && pauses ? unionOffsets(pauses, elapsed) : [];
  const segments = input.segments
    .map((s) => {
      finite(s.distanceMeters);
      checkBasis(s.observation.durationBasis);
      oneOf(s.observation.distanceSource, [
        'events',
        'route',
        'prescribed',
        'synthetic',
        'unknown',
      ]);
      requireInput(elapsed !== null && elapsed > 0);
      unionOffsets([s.observation], elapsed);
      return structuredClone(s);
    })
    .sort(
      (a, b) =>
        a.observation.startOffsetSeconds - b.observation.startOffsetSeconds ||
        compareText(a.id, b.id),
    );
  for (let i = 1; i < segments.length; i++)
    requireInput(
      segments[i].observation.startOffsetSeconds >=
        segments[i - 1].observation.endOffsetSeconds - 0.001,
    );
  const volumeEligible =
    provenance === 'recorded' &&
    temporalValid &&
    input.distanceMeters !== null &&
    input.distanceMeters > 0;
  const pace =
    elapsed !== null && input.distanceMeters !== null
      ? (elapsed * 1000) / input.distanceMeters
      : null;
  return {
    id: input.id,
    sourceId: input.sourceId?.toLowerCase() ?? null,
    sourceRevision: input.sourceRevision,
    memberIds: [input.id],
    provenance,
    measurementSource: o?.measurementSource ?? 'unknown',
    sourceBundleIdentifier: o?.sourceBundleIdentifier ?? null,
    userEntered: o?.userEntered ?? null,
    activityKind: o?.activityKind ?? 'unknown',
    distanceBasis: o?.distanceBasis ?? 'unknown',
    durationBasis: o?.durationBasis ?? 'unknown',
    durationSeconds: input.durationSeconds,
    startDate: input.startDate,
    endDate,
    distanceMeters: input.distanceMeters,
    elapsedSeconds: elapsed !== null && elapsed > 0 ? elapsed : null,
    continuity: union.length ? 'interrupted' : 'unknown',
    assertion: structuredClone(input.assertion),
    linkedWorkoutId: input.linkedWorkout?.id ?? null,
    parentSourceId: input.parentSourceId?.toLowerCase() ?? null,
    segments,
    volumeEligible,
    exposureEligible:
      volumeEligible &&
      elapsed !== null &&
      elapsed > 0 &&
      pace !== null &&
      pace >= 120 &&
      pace <= 900,
    quarantined: false,
    reasons,
  };
}

function identityLinked(a: NormalizedRun, b: NormalizedRun): boolean {
  return !!(
    (a.sourceId && a.sourceId === b.sourceId) ||
    (a.linkedWorkoutId && a.linkedWorkoutId === b.linkedWorkoutId)
  );
}
function disagreement(a: NormalizedRun, b: NormalizedRun): boolean {
  if (a.provenance !== 'recorded' || b.provenance !== 'recorded') return false;
  if (
    a.distanceMeters !== null &&
    b.distanceMeters !== null &&
    !agrees(a.distanceMeters, b.distanceMeters)
  )
    return true;
  const duration = comparableDuration(a, b);
  return duration !== null && !agrees(...duration);
}
function comparableDuration(a: NormalizedRun, b: NormalizedRun): [number, number] | null {
  if (a.elapsedSeconds !== null && b.elapsedSeconds !== null)
    return [a.elapsedSeconds, b.elapsedSeconds];
  if (
    a.durationBasis === 'active' &&
    b.durationBasis === 'active' &&
    a.durationSeconds !== null &&
    b.durationSeconds !== null
  )
    return [a.durationSeconds, b.durationSeconds];
  return null;
}
function resembles(a: NormalizedRun, b: NormalizedRun): boolean {
  const duration = comparableDuration(a, b);
  return (
    a.volumeEligible &&
    b.volumeEligible &&
    a.startDate !== null &&
    b.startDate !== null &&
    Math.abs(instant(a.startDate) - instant(b.startDate)) <= 60000 &&
    a.distanceMeters !== null &&
    b.distanceMeters !== null &&
    agrees(a.distanceMeters, b.distanceMeters) &&
    duration !== null &&
    agrees(...duration)
  );
}

/** D15 normalization; declarations and operational status never create objective measures. */
export function normalizeObjectiveEvidence(input: {
  userId: string;
  asOf: Instant;
  timeZone: string;
  capture: ObjectiveCapture | null;
  lastReadState: ReadState | null;
}): ObjectiveEvidence {
  const { userId, asOf, timeZone: zone, capture } = input;
  instant(asOf);
  timeZone(zone);
  if (input.lastReadState !== null)
    oneOf(input.lastReadState, ['complete', 'empty', 'partial', 'failed', 'unavailable']);
  if (capture) {
    owned(userId, [capture, ...capture.runs]);
    validateCoverage(capture.coverage, capture.capturedAt);
    requireInput(instant(capture.capturedAt) <= instant(asOf));
  }
  const bySource = new Map<string, ObjectiveRunInput[]>();
  for (const run of capture?.runs ?? []) {
    const key = run.sourceId?.toLowerCase() ?? `id:${run.id}`;
    const current = bySource.get(key);
    if (!current || run.sourceRevision > current[0].sourceRevision) bySource.set(key, [run]);
    else if (run.sourceRevision === current[0].sourceRevision) current.push(run);
  }
  const runs = [...bySource.values()]
    .flatMap((group) => (group.some((r) => r.withdrawn) ? [] : group))
    .map((r) => normalizeRun(r, asOf))
    .sort((a, b) => compareText(a.id, b.id));
  const groups: NormalizedRun[][] = [];
  // First compute connected components of explicit identities; approximate matching is conservative.
  for (const run of runs) {
    const matches = groups.filter((g) => g.some((r) => identityLinked(r, run)));
    if (matches.length) {
      const merged = [...matches.flat(), run];
      for (const group of matches) groups.splice(groups.indexOf(group), 1);
      groups.push(merged);
    } else groups.push([run]);
  }
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      if (groups[i].every((a) => groups[j].every((b) => resembles(a, b)))) {
        groups[i].push(...groups[j]);
        groups.splice(j--, 1);
      }
    }
  }
  const deduped = groups
    .map((group) => {
      const sorted = [...group].sort(
        (a, b) =>
          Number(b.provenance === 'recorded') - Number(a.provenance === 'recorded') ||
          Number(b.volumeEligible) - Number(a.volumeEligible) ||
          Number(b.elapsedSeconds !== null) - Number(a.elapsedSeconds !== null) ||
          Number(b.sourceId !== null) - Number(a.sourceId !== null) ||
          compareText(a.id, b.id),
      );
      const chosen = structuredClone(sorted[0]);
      chosen.memberIds = uniqueSorted(group.flatMap((r) => r.memberIds));
      chosen.quarantined = group.some((a, i) => group.slice(i + 1).some((b) => disagreement(a, b)));
      if (chosen.quarantined) {
        chosen.volumeEligible = false;
        chosen.exposureEligible = false;
        chosen.reasons.push('OBJECTIVE_CONFLICT');
      }
      // Details augment a summary of the same activity; they do not add another session.
      const details = sorted.find((r) => r.segments.length > 0);
      if (details) chosen.segments = details.segments;
      return chosen;
    })
    .sort((a, b) => compareText(a.id, b.id));
  const parents = new Set(
    deduped.filter((r) => r.volumeEligible && r.sourceId).map((r) => r.sourceId),
  );
  for (const run of deduped)
    if (run.parentSourceId && parents.has(run.parentSourceId)) {
      run.volumeEligible = false;
      run.exposureEligible = false;
      run.reasons.push('PARENT_CONTRIBUTION_EXISTS');
    }
  const efforts: Effort[] = [];
  for (const run of deduped) {
    if (
      !run.volumeEligible ||
      run.quarantined ||
      !run.startDate ||
      run.assertion?.conditions === 'non_comparable'
    )
      continue;
    const append = (id: string, distance: number | null, seconds: number | null) => {
      if (distance === null || seconds === null || distance < 1500 || seconds <= 0) return;
      const pace = (seconds * 1000) / distance;
      const index = calculateVdot(distance, seconds);
      if (pace >= 120 && pace <= 900 && index >= 20 && index <= 85)
        efforts.push({
          id,
          runId: run.id,
          startDate: run.startDate!,
          distanceMeters: distance,
          elapsedSeconds: seconds,
          index,
        });
    };
    append(run.id, run.distanceMeters, run.elapsedSeconds);
    // Each individual observed interval is an effort; never splice recoveries out or add repetitions.
    for (const segment of run.segments)
      if (['events', 'route'].includes(segment.observation.distanceSource))
        append(
          `${run.id}/${segment.id}`,
          segment.distanceMeters,
          segment.observation.endOffsetSeconds - segment.observation.startOffsetSeconds,
        );
  }
  const assertion = capture?.coverage.assertion;
  const contradictory =
    assertion?.kind === 'no_running'
      ? deduped.filter(
          (r) =>
            r.volumeEligible &&
            r.startDate !== null &&
            instant(r.startDate) >= instant(assertion.from) &&
            instant(r.startDate) < instant(assertion.to),
        )
      : [];
  const conflicts =
    assertion && contradictory.length > 0
      ? [
          {
            code: 'HISTORY_ASSERTION_CONFLICT',
            evidenceIds: uniqueSorted(contradictory.map((r) => r.id)),
            from: assertion.from,
            to: assertion.to,
          },
        ]
      : [];
  const result = {
    userId,
    asOf,
    timeZone: zone,
    capturedAt: capture?.capturedAt ?? null,
    coverage: capture?.coverage ?? null,
    lastReadState: input.lastReadState,
    runs: deduped,
    efforts: efforts.sort((a, b) => compareText(a.id, b.id)),
    conflicts,
    fresh:
      capture !== null &&
      capture.runs.length > 0 &&
      ['complete', 'partial'].includes(capture.coverage.state) &&
      instant(asOf) - instant(capture.capturedAt) <= 7 * 86400000,
  };
  // Include tombstones and origins, exclude unrelated metadata (notably HR).
  return {
    ...result,
    evidenceHash: stableHash({
      userId,
      timeZone: zone,
      capturedAt: result.capturedAt,
      coverage: result.coverage,
      lastReadState: result.lastReadState,
      runs: result.runs,
      conflicts,
      revisions: [...bySource.entries()]
        .sort(([a], [b]) => compareText(a, b))
        .map(([key, g]) => ({
          key,
          revision: g[0].sourceRevision,
          withdrawn: g.some((r) => r.withdrawn),
        })),
    }),
  };
}

export function coverageContains(
  coverage: HistoryCoverage | null,
  from: Instant,
  to: Instant,
): boolean {
  if (!coverage || coverage.truncated || !['complete', 'empty'].includes(coverage.state))
    return false;
  let cursor = instant(from);
  const end = instant(to);
  for (const interval of [...coverage.coveredIntervals].sort(
    (a, b) => instant(a.from) - instant(b.from),
  )) {
    if (instant(interval.from) > cursor) break;
    cursor = Math.max(cursor, instant(interval.to));
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

export type WeeklyObjectiveMetric = {
  from: LocalDate;
  through: LocalDate;
  measuredMeters: number;
  observedLowerBoundMeters: number;
  runDays: number;
  covered: boolean;
  evidenceIds: string[];
};
export function objectiveWeeks(
  evidence: ObjectiveEvidence,
  count: number,
): WeeklyObjectiveMetric[] {
  integer(count, 1, 52);
  const current = monday(localDate(evidence.asOf, evidence.timeZone));
  return Array.from({ length: count }, (_, i) => {
    const from = addDays(current, -7 * (count - i));
    const end = addDays(from, 7);
    const runs = evidence.runs.filter(
      (r) =>
        r.volumeEligible &&
        r.startDate &&
        localDate(r.startDate, evidence.timeZone) >= from &&
        localDate(r.startDate, evidence.timeZone) < end,
    );
    const measuredMeters = runs.reduce((sum, r) => sum + r.distanceMeters!, 0);
    return {
      from,
      through: addDays(end, -1),
      measuredMeters,
      observedLowerBoundMeters: measuredMeters,
      runDays: new Set(runs.map((r) => localDate(r.startDate!, evidence.timeZone))).size,
      covered: coverageContains(
        evidence.coverage,
        startOfDate(from, evidence.timeZone),
        startOfDate(end, evidence.timeZone),
      ),
      evidenceIds: uniqueSorted(runs.map((r) => r.id)),
    };
  });
}
export function averageWeeklyMeters(
  evidence: ObjectiveEvidence,
  count: number,
): { value: number | null; observedLowerBoundMeters: number } {
  const weeks = objectiveWeeks(evidence, count);
  const lower = weeks.reduce((s, w) => s + w.measuredMeters, 0) / count;
  return { value: weeks.every((w) => w.covered) ? lower : null, observedLowerBoundMeters: lower };
}

function age(evidence: ObjectiveEvidence, run: { startDate: Instant }): number {
  return civilAge(localDate(run.startDate, evidence.timeZone), evidence.asOf, evidence.timeZone);
}
export function eligibleIndex(
  evidence: ObjectiveEvidence,
  distance: number,
  purpose: 'goal' | 'training' = 'goal',
): Effort | null {
  const minDistance =
    purpose === 'goal' && distance > 21097.5 ? distance : Math.max(1500, distance / 2.2);
  return (
    evidence.efforts
      .filter(
        (e) => e.distanceMeters >= minDistance && age(evidence, e) >= 0 && age(evidence, e) <= 42,
      )
      .sort(
        (a, b) =>
          b.index - a.index ||
          instant(b.startDate) - instant(a.startDate) ||
          compareText(a.id, b.id),
      )[0] ?? null
  );
}
export function validIndex(distance: number, seconds: number): number | null {
  finite(distance);
  finite(seconds);
  if (distance <= 0 || seconds <= 0) return null;
  const pace = (seconds * 1000) / distance;
  const index = calculateVdot(distance, seconds);
  return pace >= 120 && pace <= 900 && index >= 20 && index <= 85 ? index : null;
}
/** Bracket first; refine the existing integer presentation inverse before any policy rounding. */
export function equivalentSeconds(index: number, distance: number): number | null {
  finite(index);
  finite(distance);
  if (index < 20 || index > 85 || distance < 1500 || distance > 42195) return null;
  let lo = distance * 0.12;
  let hi = distance * 0.9;
  if (
    calculateVdot(distance, lo) + EPSILON < index ||
    calculateVdot(distance, hi) - EPSILON > index
  )
    return null;
  const rounded = predictRaceTime(index, distance);
  lo = Math.max(lo, rounded - 1);
  hi = Math.min(hi, rounded + 1);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (calculateVdot(distance, mid) > index) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type GoalTarget = {
  modality: string;
  distanceMeters: number | null;
  timeSeconds: number | null;
  eventDate: LocalDate | null;
  timeZone: string;
};
export type Component = { state: GoalSupport | 'not_applicable'; reasons: ObjectiveReason[] };
export type Summary = {
  current: GoalSupport;
  byDate: GoalSupport | 'conditional';
  confidence: Confidence;
  performance: Component;
  endurance: Component;
  reasons: ObjectiveReason[];
};
export type GoalAssessment = {
  assessment: Summary;
  daysAvailable: number | null;
  weeksAvailable: number | null;
  performance: {
    observedEquivalentVdot: number | null;
    requiredVdot: number | null;
    equivalentTimeNowSeconds: number | null;
    projectedVdot: null;
  };
  scenario: null | {
    kind: 'maintain_observed' | 'requirements_not_yet_demonstrated';
    requiredVdot: number | null;
    requiredWeeklyMeters: number;
    requiredLongRunMeters: number;
    requiredWeeks: number;
    pending: string[];
  };
};
function reason(
  code: string,
  ids: string[] = [],
  facts: ObjectiveReason['facts'] = [],
): ObjectiveReason {
  return { code, evidenceIds: uniqueSorted(ids), facts };
}
function category(distance: number): {
  n: number;
  frequencyWeeks: number;
  days: number;
  longWindow: number;
} {
  return distance <= 10000
    ? { n: 4, frequencyWeeks: 3, days: 2, longWindow: 28 }
    : distance <= 21097.5
      ? { n: 6, frequencyWeeks: 4, days: 2, longWindow: 42 }
      : { n: 8, frequencyWeeks: 6, days: 3, longWindow: 56 };
}
function confidence(
  evidence: ObjectiveEvidence,
  admissible: { startDate: Instant }[],
  recentDays: number,
  from: LocalDate,
): Confidence {
  if (!admissible.length) return 'none';
  if (
    !evidence.fresh ||
    evidence.lastReadState !== 'complete' ||
    !evidence.capturedAt ||
    !coverageContains(
      evidence.coverage,
      startOfDate(from, evidence.timeZone),
      evidence.capturedAt,
    ) ||
    evidence.runs.some(
      (r) => r.quarantined && r.startDate && localDate(r.startDate, evidence.timeZone) >= from,
    ) ||
    evidence.conflicts.some((c) => instant(c.to) > instant(startOfDate(from, evidence.timeZone))) ||
    !admissible.some((r) => age(evidence, r) >= 0 && age(evidence, r) <= recentDays)
  )
    return 'low';
  return 'medium';
}

export function assessGoal(target: GoalTarget, evidence: ObjectiveEvidence): GoalAssessment {
  timeZone(target.timeZone);
  requireInput(target.timeZone === evidence.timeZone);
  if (target.distanceMeters !== null) finite(target.distanceMeters);
  if (target.timeSeconds !== null) integer(target.timeSeconds, 1);
  if (target.eventDate !== null) civil(target.eventDate);
  const today = localDate(evidence.asOf, target.timeZone);
  const daysAvailable = target.eventDate ? daysBetween(today, target.eventDate) : null;
  const d = target.distanceMeters;
  const numericDomain = d !== null && d >= 1500 && d <= 42195;
  const required =
    numericDomain && target.timeSeconds !== null ? validIndex(d, target.timeSeconds) : null;
  const domain =
    numericDomain &&
    target.modality === 'running' &&
    (target.timeSeconds === null || required !== null);
  const reasons: ObjectiveReason[] = [];
  if (!domain) reasons.push(reason('GOAL_OUTSIDE_DOMAIN'));
  if (daysAvailable !== null && daysAvailable <= 0) reasons.push(reason('EVENT_NOT_FUTURE'));
  if (daysAvailable !== null && daysAvailable > 365) reasons.push(reason('HORIZON_OUTSIDE_DOMAIN'));
  const distance = d ?? 0;
  const c = category(distance);
  const observed = domain ? eligibleIndex(evidence, distance) : null;
  const historicalEfforts = evidence.efforts.filter(
    (e) => e.distanceMeters >= (distance > 21097.5 ? distance : Math.max(1500, distance / 2.2)),
  );
  const sessions = evidence.runs.filter(
    (r): r is NormalizedRun & { startDate: Instant } => r.volumeEligible && r.startDate !== null,
  );
  const exposures = sessions.filter((r) => r.exposureEligible);
  const recent = sessions.some((r) => age(evidence, r) >= 0 && age(evidence, r) <= 14);
  const direct = exposures.some(
    (r) =>
      age(evidence, r) >= 0 &&
      age(evidence, r) <= 28 &&
      r.distanceMeters! >= distance &&
      sessions.some(
        (other) =>
          other.id !== r.id &&
          age(evidence, other) >= 0 &&
          age(evidence, other) <= 14 &&
          localDate(other.startDate, target.timeZone) !== localDate(r.startDate, target.timeZone),
      ),
  );
  const weeks = objectiveWeeks(evidence, c.n);
  const completeFrom = addDays(monday(today), -7 * c.n);
  const requiredFrom = direct ? addDays(today, -28) : completeFrom;
  const covered =
    evidence.capturedAt !== null &&
    coverageContains(
      evidence.coverage,
      startOfDate(requiredFrom, target.timeZone),
      evidence.capturedAt,
    );
  const longSessions = exposures.filter(
    (r) => age(evidence, r) >= 0 && age(evidence, r) <= c.longWindow,
  );
  const longMax = Math.max(0, ...longSessions.map((r) => r.distanceMeters!));
  const volume = weeks.every((w) => w.covered)
    ? weeks.reduce((s, w) => s + w.measuredMeters, 0) / c.n
    : null;
  const preparation =
    volume !== null &&
    volume + EPSILON >= 1.5 * distance &&
    weeks.filter((w) => w.runDays >= c.days).length >= c.frequencyWeeks &&
    longMax + EPSILON >= 0.75 * distance &&
    longSessions.filter((r) => r.distanceMeters! + EPSILON >= 0.6 * distance).length >= 2 &&
    recent;
  const assertion = evidence.coverage?.assertion;
  const allRecorded =
    assertion?.kind === 'all_runs_recorded' &&
    instant(assertion.from) <= instant(startOfDate(completeFrom, target.timeZone)) &&
    evidence.capturedAt !== null &&
    instant(assertion.to) >= instant(evidence.capturedAt);
  const unusable = evidence.runs.some(
    (r) =>
      r.activityKind !== 'other' &&
      (r.startDate === null ||
        (localDate(r.startDate, target.timeZone) >= completeFrom &&
          !r.volumeEligible &&
          !r.reasons.includes('PARENT_CONTRIBUTION_EXISTS'))),
  );
  const performance: Component = {
    state: !domain
      ? 'unavailable'
      : target.timeSeconds === null
        ? 'not_applicable'
        : observed && required !== null && observed.index + EPSILON >= required
          ? 'supported'
          : 'insufficient_data',
    reasons: [],
  };
  if (performance.state === 'insufficient_data')
    performance.reasons.push(
      reason(
        distance > 21097.5 && !observed
          ? 'LONG_DISTANCE_TIME_UNAVAILABLE'
          : 'PERFORMANCE_NOT_DEMONSTRATED',
        observed ? [observed.id] : [],
      ),
    );
  const endurance: Component = {
    state: !domain
      ? 'unavailable'
      : direct || preparation
        ? 'supported'
        : evidence.fresh && covered && allRecorded && !unusable
          ? 'not_supported'
          : 'insufficient_data',
    reasons: [
      reason(
        'ENDURANCE_REQUIREMENTS',
        [],
        [
          { name: 'weeklyMeters', value: volume, unit: 'm/week' },
          { name: 'requiredWeeklyMeters', value: 1.5 * distance, unit: 'm/week' },
          { name: 'largestSessionMeters', value: longMax, unit: 'm' },
          { name: 'requiredLargestSessionMeters', value: 0.75 * distance, unit: 'm' },
        ],
      ),
    ],
  };
  let current: GoalSupport = !domain
    ? 'unavailable'
    : endurance.state === 'not_supported'
      ? 'not_supported'
      : endurance.state === 'supported' &&
          ['supported', 'not_applicable'].includes(performance.state)
        ? 'supported'
        : 'insufficient_data';
  if (current === 'supported' && !evidence.fresh) {
    current = 'insufficient_data';
    reasons.push(reason('OBJECTIVE_CONTEXT_STALE'));
  }
  const byDate: Summary['byDate'] =
    !domain || daysAvailable === null || daysAvailable <= 0 || daysAvailable > 365
      ? 'unavailable'
      : !evidence.fresh
        ? 'insufficient_data'
        : daysAvailable <= 28
          ? current
          : current === 'supported'
            ? 'conditional'
            : 'insufficient_data';
  const levels: Confidence[] = [confidence(evidence, sessions, 14, requiredFrom)];
  if (target.timeSeconds !== null)
    levels.push(confidence(evidence, historicalEfforts, 42, addDays(today, -42)));
  const rank: Confidence[] = ['none', 'low', 'medium', 'high'];
  const quality = domain
    ? levels.reduce((a, b) => (rank.indexOf(a) <= rank.indexOf(b) ? a : b))
    : 'none';
  return {
    assessment: { current, byDate, confidence: quality, performance, endurance, reasons },
    daysAvailable,
    weeksAvailable: daysAvailable === null ? null : Math.floor(daysAvailable / 7),
    performance: {
      observedEquivalentVdot: observed?.index ?? null,
      requiredVdot: required,
      equivalentTimeNowSeconds:
        target.timeSeconds === null || !observed
          ? null
          : equivalentSeconds(observed.index, distance),
      projectedVdot: null,
    },
    scenario:
      domain && daysAvailable !== null && daysAvailable > 28 && daysAvailable <= 365
        ? {
            kind:
              current === 'supported' ? 'maintain_observed' : 'requirements_not_yet_demonstrated',
            requiredVdot: required,
            requiredWeeklyMeters: 1.5 * distance,
            requiredLongRunMeters: 0.75 * distance,
            requiredWeeks: c.n,
            pending: [
              performance.state === 'insufficient_data' ? 'PERFORMANCE_NOT_DEMONSTRATED' : null,
              endurance.state !== 'supported' ? 'ENDURANCE_NOT_DEMONSTRATED' : null,
            ].filter((v): v is string => v !== null),
          }
        : null,
  };
}

export type Alternative = {
  id: string;
  axis: 'time' | 'distance' | 'both';
  target: GoalTarget;
  assessment: Summary;
};
export function goalAlternatives(
  evaluationId: string,
  target: GoalTarget,
  evidence: ObjectiveEvidence,
): Alternative[] {
  const original = assessGoal(target, evidence);
  if (
    !evidence.fresh ||
    original.assessment.current === 'supported' ||
    original.assessment.current === 'unavailable' ||
    original.daysAvailable === null ||
    original.daysAvailable <= 0 ||
    original.daysAvailable > 365 ||
    target.distanceMeters === null
  )
    return [];
  const alternatives: Alternative[] = [];
  const seen = new Set<string>();
  const add = (axis: Alternative['axis'], candidate: GoalTarget): boolean => {
    const assessment = assessGoal(candidate, evidence).assessment;
    if (assessment.current !== 'supported' || !['medium', 'high'].includes(assessment.confidence))
      return false;
    const key = stableHash(candidate);
    if (!seen.has(key)) {
      seen.add(key);
      alternatives.push({
        id: stableHash({ evaluationId, axis, target: candidate }),
        axis,
        target: candidate,
        assessment,
      });
    }
    return true;
  };
  const rounded = (candidate: GoalTarget): GoalTarget | null => {
    const effort = eligibleIndex(evidence, candidate.distanceMeters!);
    const seconds = effort ? equivalentSeconds(effort.index, candidate.distanceMeters!) : null;
    if (seconds === null) return null;
    const time = Math.ceil(seconds / 30) * 30;
    const first = { ...candidate, timeSeconds: time };
    return assessGoal(first, evidence).assessment.current === 'supported'
      ? first
      : { ...first, timeSeconds: time + 30 };
  };
  if (target.timeSeconds !== null) {
    const candidate = rounded(target);
    if (candidate && candidate.timeSeconds! - target.timeSeconds >= 30) add('time', candidate);
  }
  const grid = [...Array.from({ length: 407 }, (_, i) => 1500 + i * 100), 21097.5, 42195]
    .filter((d) => d <= target.distanceMeters! - 100)
    .sort((a, b) => b - a);
  for (const distance of grid) if (add('distance', { ...target, distanceMeters: distance })) break;
  if (target.timeSeconds !== null)
    for (const distance of grid) {
      const candidate = rounded({ ...target, distanceMeters: distance });
      if (
        candidate &&
        Math.abs(candidate.timeSeconds! - target.timeSeconds) >= 30 &&
        add('both', candidate)
      )
        break;
    }
  return alternatives;
}

export type ObjectiveEvaluation = GoalAssessment & {
  schemaVersion: 2;
  id: string;
  goalId: string;
  goalVersion: number;
  engineVersion: typeof ENGINE_VERSION;
  asOf: Instant;
  expiresAt: Instant;
  evidenceHash: string;
  preferencesHash: string;
  target: GoalTarget;
  alternatives: Alternative[];
};
export function evaluateGoal(input: {
  id: string;
  goalId: string;
  goalVersion: number;
  preferencesHash: string;
  target: GoalTarget;
  evidence: ObjectiveEvidence;
}): ObjectiveEvaluation {
  integer(input.goalVersion, 1);
  requireInput(input.id.length > 0 && input.goalId.length > 0 && input.preferencesHash.length > 0);
  return {
    schemaVersion: 2 as const,
    id: input.id,
    goalId: input.goalId,
    goalVersion: input.goalVersion,
    engineVersion: ENGINE_VERSION,
    asOf: input.evidence.asOf,
    expiresAt: evaluationExpiresAt(input.evidence.asOf, input.target.timeZone),
    evidenceHash: input.evidence.evidenceHash,
    preferencesHash: input.preferencesHash,
    target: structuredClone(input.target),
    ...assessGoal(input.target, input.evidence),
    alternatives: goalAlternatives(input.id, input.target, input.evidence),
  };
}

export type ObjectivePaceContext = {
  eligible: boolean;
  B: number | null;
  L: number | null;
  H: number | null;
  trainingIndex: number | null;
  maxWeekMeters: number | null;
  maxSessionMeters: number | null;
  maxSessionSeconds: number | null;
  preparationAverageMeters: number | null;
  zones: ReturnType<typeof derivePaceZones> | null;
};
export function objectivePaceContext(
  evidence: ObjectiveEvidence,
  target: GoalTarget,
): ObjectivePaceContext {
  const v4 = averageWeeklyMeters(evidence, 4).value;
  const v2 = averageWeeklyMeters(evidence, 2).value;
  const B = v4 === null || v2 === null ? null : Math.min(v4, v2);
  const exposures = evidence.runs.filter(
    (r) =>
      r.exposureEligible &&
      r.startDate &&
      civilAge(localDate(r.startDate, evidence.timeZone), evidence.asOf, evidence.timeZone) <= 30,
  );
  const L = exposures.length ? Math.max(...exposures.map((r) => r.distanceMeters!)) : null;
  const H = exposures.length ? Math.max(...exposures.map((r) => r.elapsedSeconds!)) : null;
  const trainingIndex =
    target.distanceMeters === null
      ? null
      : (eligibleIndex(evidence, target.distanceMeters, 'training')?.index ?? null);
  const requiredFrom = addDays(monday(localDate(evidence.asOf, evidence.timeZone)), -28);
  const conflict =
    evidence.conflicts.some(
      (c) => civilAge(localDate(c.to, evidence.timeZone), evidence.asOf, evidence.timeZone) <= 42,
    ) ||
    evidence.runs.some(
      (r) =>
        r.quarantined &&
        (r.startDate === null ||
          civilAge(localDate(r.startDate, evidence.timeZone), evidence.asOf, evidence.timeZone) <=
            42),
    );
  const currentCovered =
    evidence.capturedAt !== null &&
    coverageContains(
      evidence.coverage,
      startOfDate(requiredFrom, evidence.timeZone),
      evidence.capturedAt,
    );
  const eligible =
    evidence.fresh &&
    evidence.lastReadState === 'complete' &&
    currentCovered &&
    !conflict &&
    B !== null &&
    B > 0 &&
    L !== null &&
    L > 0 &&
    H !== null &&
    H > 0 &&
    trainingIndex !== null;
  const maxWeekMeters = B === null ? null : Math.floor((1.1 * B) / 100) * 100;
  return {
    eligible,
    B,
    L,
    H,
    trainingIndex,
    maxWeekMeters,
    maxSessionMeters:
      L === null || maxWeekMeters === null
        ? null
        : Math.floor(Math.min(1.1 * L, 0.5 * maxWeekMeters) / 100) * 100,
    maxSessionSeconds: H === null ? null : Math.floor((1.1 * H) / 60) * 60,
    preparationAverageMeters:
      target.distanceMeters === null
        ? null
        : (averageWeeklyMeters(evidence, category(target.distanceMeters).n).value ?? v4),
    zones: trainingIndex === null ? null : derivePaceZones(trainingIndex),
  };
}
