import {
  addDays,
  civil,
  civilAge,
  daysBetween,
  floor30,
  instant,
  integer,
  localDate,
  monday,
  owned,
  requireInput,
  timeZone,
  uniqueSorted,
} from './core';
import type { Instant, LocalDate } from './core';
import type {
  ContinuityReport,
  DoseAnchor,
  DurationBaseline,
  ExperienceContext,
  HistoryState,
  MissingContextField,
  RoutineReport,
} from './types';
import type { CanonicalSession, SessionRelation } from './sessions';
import { sessionWindowHash, validateRpe } from './sessions';

export type InventoryAssertion = {
  userId: string;
  id: string;
  revision: number;
  timeZone: string;
  periodFrom: LocalDate;
  periodThrough: LocalDate;
  sessionSetHash: string;
  assertion: 'all_sessions_included';
  confirmedAt: Instant;
};
export type BaselineInput = {
  userId: string;
  asOf: Instant;
  timeZone: string;
  experience: ExperienceContext;
  routine: RoutineReport | null;
  continuity: ContinuityReport | null;
  sessions: CanonicalSession[];
  relations: SessionRelation[];
  conflicts: Array<{ memberIds: string[] }>;
  inventory: InventoryAssertion | null;
  /** Additional actual practice dates from D15; never scheduled dates. */
  objectivePracticeDates: LocalDate[];
  preservedReference: DoseAnchor | null;
  /** Existing/current independent source IDs; a reference alone cannot attest its own usability. */
  usableSourceIds: string[];
};
export type BaselineResult = {
  baseline: DurationBaseline | null;
  source:
    | 'complete_inventory'
    | 'reported_routine'
    | 'observed_lower_bound'
    | 'preserved_reference'
    | null;
  inventoryUsable: boolean;
  lastRunOn: LocalDate | null;
  interruptionDays: number | null;
  continuityUsable: boolean;
  historyState: HistoryState;
  hasConflict: boolean;
  missingFields: MissingContextField[];
};

export function experienceFromLegacy(
  level: string | null,
  declaredAt: Instant | null,
): ExperienceContext {
  if (declaredAt) instant(declaredAt);
  if (level && ['beginning', 'beginner'].includes(level))
    return { level: 'beginner', source: 'legacy_assessment', declaredAt };
  if (level && ['hobby', 'intermediate', 'advanced', 'pro'].includes(level))
    return { level: 'experienced', source: 'legacy_assessment', declaredAt };
  return { level: 'unknown', source: 'unknown', declaredAt: null };
}

export function validateRoutine(routine: RoutineReport, asOf: Instant): void {
  timeZone(routine.timeZone);
  integer(routine.revision, 1);
  requireInput(
    routine.origin === 'reported' && daysBetween(routine.periodFrom, routine.periodThrough) === 13,
  );
  requireInput(
    routine.periodThrough <= localDate(asOf, routine.timeZone) &&
      instant(routine.confirmedAt) <= instant(asOf),
  );
  if (routine.weeklyRunDays !== null) integer(routine.weeklyRunDays, 0, 7);
  if (routine.usualSessionSeconds !== null) integer(routine.usualSessionSeconds, 0, 86400);
  requireInput(
    !(
      routine.weeklyRunDays !== null &&
      routine.weeklyRunDays > 0 &&
      routine.usualSessionSeconds === 0
    ),
  );
  validateRpe(routine.usualEffortRpe);
  validateRpe(routine.currentFatigue);
}

export function routineBaseline(
  routine: RoutineReport,
  asOf: Instant,
  zone: string,
): DurationBaseline | null {
  validateRoutine(routine, asOf);
  const age = civilAge(routine.periodThrough, asOf, zone);
  if (
    routine.timeZone !== zone ||
    age < 0 ||
    age > 28 ||
    routine.weeklyRunDays === null ||
    routine.weeklyRunDays <= 0 ||
    routine.usualSessionSeconds === null ||
    routine.usualSessionSeconds <= 0
  )
    return null;
  const frequencyDays = Math.min(5, routine.weeklyRunDays);
  const sessionSeconds = floor30(
    Math.min(routine.usualSessionSeconds, 5400, 18000 / frequencyDays),
  );
  // A positive source smaller than the quantum remains a usable source for a no_sessions proposal.
  return {
    source: 'reported_routine',
    referenceIds: [`routine:${routine.id}:${routine.revision}`],
    referenceFrom: routine.periodFrom,
    referenceThrough: routine.periodThrough,
    frequencyDays,
    sessionSeconds,
    nominalWeekSeconds: frequencyDays * sessionSeconds,
  };
}

export function sessionsBaseline(
  sessions: readonly CanonicalSession[],
  from: LocalDate,
  through: LocalDate,
): DurationBaseline | null {
  requireInput(daysBetween(from, through) === 13);
  const eligible = sessions
    .map((s) => s.observation)
    .filter(
      (o) =>
        o.duration.state === 'usable' &&
        o.activeSeconds !== null &&
        o.activeSeconds > 0 &&
        ['running', 'run_walk'].includes(o.activityKind) &&
        o.activityDate !== null &&
        o.activityDate >= from &&
        o.activityDate <= through,
    );
  const split = addDays(from, 7);
  const w1 = eligible.filter((o) => o.activityDate! < split);
  const w2 = eligible.filter((o) => o.activityDate! >= split);
  const frequencyDays = Math.min(
    5,
    new Set(w1.map((o) => o.activityDate)).size,
    new Set(w2.map((o) => o.activityDate)).size,
  );
  if (frequencyDays <= 0) return null;
  const values = eligible.map((o) => o.activeSeconds!).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  const weekSeconds = Math.min(
    w1.reduce((s, o) => s + o.activeSeconds!, 0),
    w2.reduce((s, o) => s + o.activeSeconds!, 0),
  );
  const sessionSeconds = floor30(
    Math.min(median, weekSeconds / frequencyDays, 5400, 18000 / frequencyDays),
  );
  const provenances = new Set(eligible.map((o) => o.provenance));
  return {
    source:
      provenances.size > 1
        ? 'mixed_sessions'
        : provenances.has('recorded')
          ? 'recorded_sessions'
          : 'reported_sessions',
    referenceIds: uniqueSorted(eligible.flatMap((o) => o.referenceIds)),
    referenceFrom: from,
    referenceThrough: through,
    frequencyDays,
    sessionSeconds,
    nominalWeekSeconds: frequencyDays * sessionSeconds,
  };
}

export function deriveDurationBaseline(input: BaselineInput): BaselineResult {
  const { asOf, timeZone: zone } = input;
  instant(asOf);
  timeZone(zone);
  owned(input.userId, [...input.relations, ...input.sessions]);
  const today = localDate(asOf, zone);
  const from = addDays(monday(today), -14);
  const through = addDays(monday(today), -1);
  if (input.routine) validateRoutine(input.routine, asOf);
  if (input.continuity) {
    const c = input.continuity;
    timeZone(c.timeZone);
    civil(c.observedThrough);
    integer(c.revision, 1);
    requireInput(
      c.origin === 'reported' &&
        c.observedThrough <= today &&
        instant(c.confirmedAt) <= instant(asOf),
    );
    if (c.lastRunOn) requireInput(civil(c.lastRunOn) <= civil(c.observedThrough));
  }
  const excluded = new Set(input.conflicts.flatMap((c) => c.memberIds));
  const independentSessions = input.sessions.filter(
    (s) => !s.memberIds.some((m) => excluded.has(m)),
  );
  const positiveDates = uniqueSorted([
    ...input.objectivePracticeDates,
    ...independentSessions
      .map((s) => s.observation)
      .filter(
        (o) =>
          o.activeSeconds !== null &&
          o.activeSeconds > 0 &&
          ['running', 'run_walk'].includes(o.activityKind),
      )
      .map((o) => o.activityDate)
      .filter((d): d is string => d !== null),
  ]);
  positiveDates.forEach((d) => requireInput(civil(d) <= civil(today)));
  const continuity = input.continuity;
  const continuityContradiction = !!(
    continuity?.lastRunOn &&
    positiveDates.some((d) => d > continuity.lastRunOn! && d <= continuity.observedThrough)
  );
  const continuityUsable =
    !!continuity &&
    continuity.timeZone === zone &&
    civilAge(continuity.observedThrough, asOf, zone) <= 7 &&
    !continuityContradiction;
  const assertedLastRun = continuityUsable ? continuity.lastRunOn : null;
  const lastRunOn =
    uniqueSorted([...positiveDates, ...(assertedLastRun ? [assertedLastRun] : [])]).at(-1) ?? null;
  const noHistoryContradiction =
    input.experience.level === 'no_history' &&
    input.experience.declaredAt !== null &&
    (positiveDates.some((d) => d < localDate(input.experience.declaredAt!, zone)) ||
      independentSessions.some(
        (s) =>
          s.startedAt !== null &&
          s.observation.activeSeconds !== null &&
          s.observation.activeSeconds > 0 &&
          instant(s.startedAt) < instant(input.experience.declaredAt!),
      ));
  const hasConflict =
    input.conflicts.length > 0 || continuityContradiction || noHistoryContradiction;
  const recent = lastRunOn !== null && civilAge(lastRunOn, asOf, zone) <= 14;
  const interruptionDays =
    continuityUsable &&
    continuity.lastRunOn !== null &&
    !positiveDates.some((d) => d > continuity.lastRunOn!)
      ? civilAge(continuity.lastRunOn, asOf, zone)
      : null;
  const inventory = input.inventory;
  if (inventory) {
    owned(input.userId, [inventory]);
    instant(inventory.confirmedAt);
    requireInput(instant(inventory.confirmedAt) <= instant(asOf));
    integer(inventory.revision, 1);
  }
  const inventoryUsable =
    !!inventory &&
    inventory.timeZone === zone &&
    inventory.periodFrom === from &&
    inventory.periodThrough === through &&
    inventory.assertion === 'all_sessions_included' &&
    inventory.sessionSetHash ===
      sessionWindowHash({ ...input, periodFrom: from, periodThrough: through });
  const sessionCandidate = sessionsBaseline(independentSessions, from, through);
  const routineCandidate = input.routine ? routineBaseline(input.routine, asOf, zone) : null;
  let baseline: DurationBaseline | null = null;
  let source: BaselineResult['source'] = null;
  if (
    recent ||
    (continuityUsable && interruptionDays !== null && interruptionDays > 14 && routineCandidate)
  ) {
    if (inventoryUsable && sessionCandidate) {
      baseline = sessionCandidate;
      source = 'complete_inventory';
    } else if (routineCandidate) {
      baseline = routineCandidate;
      source = 'reported_routine';
    } else if (sessionCandidate) {
      baseline = sessionCandidate;
      source = 'observed_lower_bound';
    } else if (
      input.preservedReference &&
      input.preservedReference.basisIds.some((id) => input.usableSourceIds.includes(id))
    ) {
      const r = input.preservedReference;
      baseline = {
        source: 'mixed_sessions',
        referenceIds: [...r.basisIds],
        referenceFrom: from,
        referenceThrough: through,
        frequencyDays: r.nominalSessionsPerWeek,
        sessionSeconds: r.sessionSeconds,
        nominalWeekSeconds: r.nominalWeekSeconds,
      };
      source = 'preserved_reference';
    }
  }
  const missingFields: MissingContextField[] = [];
  if (!baseline) {
    if (input.sessions.some((s) => s.dateAmbiguous)) missingFields.push('confirm_current_routine');
    if (!input.routine && !sessionCandidate && input.experience.level === 'unknown')
      missingFields.push('experience_or_routine');
    if (
      input.routine?.weeklyRunDays === null ||
      (!input.routine && !sessionCandidate) ||
      input.routine?.weeklyRunDays === 0
    )
      missingFields.push('weekly_run_days');
    if (input.routine?.usualSessionSeconds === null || (!input.routine && !sessionCandidate))
      missingFields.push('usual_session_duration');
    if (!recent && (interruptionDays === null || interruptionDays <= 14))
      missingFields.push('last_run_date');
    if (
      !routineCandidate &&
      input.routine &&
      civilAge(input.routine.periodThrough, asOf, zone) > 28
    )
      missingFields.push('confirm_current_routine');
    if (
      input.sessions.some(
        (s) =>
          s.observation.duration.state === 'missing' &&
          s.durationCandidates.some(
            (c) => c.seconds !== null && c.seconds > 0 && c.basis !== 'active',
          ),
      )
    )
      missingFields.push('duration_basis');
  }
  return {
    baseline,
    source,
    inventoryUsable,
    lastRunOn,
    interruptionDays,
    continuityUsable,
    historyState: hasConflict
      ? 'conflicting'
      : interruptionDays !== null && interruptionDays > 14
        ? 'interrupted'
        : recent
          ? 'recent'
          : input.experience.level === 'no_history'
            ? 'none_confirmed'
            : 'unknown',
    hasConflict,
    missingFields: [...new Set(missingFields)],
  };
}

/** Evaluate historical sources at the last actual run, rather than pretending they are current. */
export function historicalResumeAnchor(input: {
  userId: string;
  lastRunOn: LocalDate;
  timeZone: string;
  routine: RoutineReport | null;
  sessions?: CanonicalSession[];
  reference: DoseAnchor;
  existingSourceIds: string[];
  conflictingSourceIds: string[];
}): DoseAnchor | null {
  const r = input.reference;
  owned(input.userId, input.sessions ?? []);
  if (
    r.basisIds.some(
      (id) => !input.existingSourceIds.includes(id) || input.conflictingSourceIds.includes(id),
    )
  )
    return null;
  if (input.routine) {
    const routine = input.routine;
    const age = daysBetween(routine.periodThrough, input.lastRunOn);
    if (
      routine.timeZone !== input.timeZone ||
      age < 0 ||
      age > 28 ||
      !routine.weeklyRunDays ||
      !routine.usualSessionSeconds
    )
      return null;
    if (!r.basisIds.includes(`routine:${routine.id}:${routine.revision}`)) return null;
  } else {
    const end = addDays(monday(input.lastRunOn), -1);
    const baseline = sessionsBaseline(input.sessions ?? [], addDays(end, -13), end);
    if (!baseline || !baseline.referenceIds.some((id) => r.basisIds.includes(id))) return null;
  }
  return structuredClone(r);
}
