import { compareText } from './core';
import {
  addDays,
  civil,
  civilAge,
  daysBetween,
  ENGINE_VERSION,
  finite,
  floor30,
  instant,
  integer,
  localDate,
  monday,
  owned,
  POLICY_VERSION,
  requireInput,
  stableHash,
  uniqueSorted,
} from './core';
import type { Instant, LocalDate } from './core';
import type {
  ControlBounds,
  DoseAnchor,
  DoseCommit,
  DoseControlState,
  DoseObservation,
  ExerciseStrategy,
  PrescriptionCommon,
  ResumeEpisode,
  RoutineReport,
  SignalReceipt,
} from './types';
import { entryDoseSeconds } from './trees';

export type SourceFact = {
  userId: string;
  id: string;
  revision: number;
  withdrawn: boolean;
  conflicting: boolean;
  /** Null means no independent temporal expiry; the consuming rule may still have an age limit. */
  expiresAt: Instant | null;
};
export type DoseSignal = {
  userId: string;
  occurrenceKey: string;
  aliases: string[];
  sourceRevisionIds: string[];
  kind: 'ratings' | 'adherence' | 'resume';
  on: LocalDate;
  factor: 0.6 | 0.8 | 0.9 | 1;
};
export type Opportunity = {
  id: string;
  prescribedSeconds: number;
  actualSeconds: number | null;
  completion: DoseObservation['completion'];
  effortRpe: number | null;
  fatigue: number | null;
  feedbackExplicit: boolean;
};
export type DeliveredWeek = {
  userId: string;
  id: string;
  from: LocalDate;
  through: LocalDate;
  deliveredOn: LocalDate;
  completeExpectedInventory: boolean;
  opportunities: Opportunity[];
  conflict: boolean;
  restriction: boolean;
  controlRevisionAfter: number;
};
export type Adherence = {
  aMin: number | null;
  aMax: number | null;
  actualTotalSeconds: number | null;
  tolerated: boolean;
};

export function weekAdherence(week: DeliveredWeek): Adherence {
  requireInput(new Set(week.opportunities.map((o) => o.id)).size === week.opportunities.length);
  requireInput(daysBetween(week.from, week.through) === 6 && monday(week.from) === week.from);
  let denominator = 0;
  let low = 0;
  let high = 0;
  let actualTotal = 0;
  let allKnown = true;
  for (const o of week.opportunities) {
    requireInput(finite(o.prescribedSeconds) >= 0);
    if (o.actualSeconds !== null) requireInput(finite(o.actualSeconds) >= 0);
    if (o.effortRpe !== null) integer(o.effortRpe, 1, 10);
    if (o.fatigue !== null) integer(o.fatigue, 1, 10);
    denominator += o.prescribedSeconds;
    if (o.completion === 'not_started') {
      requireInput(o.actualSeconds === null || o.actualSeconds === 0);
      continue;
    }
    if (o.actualSeconds === null) {
      high += o.prescribedSeconds;
      allKnown = false;
    } else {
      const credit = Math.min(o.actualSeconds, o.prescribedSeconds);
      low += credit;
      high += credit;
      actualTotal += o.actualSeconds;
    }
  }
  const aMin = denominator > 0 ? low / denominator : null;
  const aMax = denominator > 0 ? high / denominator : null;
  return {
    aMin,
    aMax,
    actualTotalSeconds: allKnown ? actualTotal : null,
    tolerated:
      denominator > 0 &&
      week.deliveredOn < week.from &&
      week.completeExpectedInventory &&
      allKnown &&
      aMin !== null &&
      aMin >= 0.9 &&
      !week.conflict &&
      !week.restriction &&
      week.opportunities.every(
        (o) =>
          o.completion === 'done' &&
          o.feedbackExplicit &&
          o.effortRpe !== null &&
          o.effortRpe <= 4 &&
          o.fatigue !== null &&
          o.fatigue <= 4,
      ),
  };
}

function ratingFactor(effort: number | null, fatigue: number | null): 0.8 | 0.9 | 1 {
  if (effort !== null) integer(effort, 1, 10);
  if (fatigue !== null) integer(fatigue, 1, 10);
  if ((effort !== null && effort >= 8) || (fatigue !== null && fatigue >= 8)) return 0.8;
  if ((effort !== null && effort >= 7) || (fatigue !== null && fatigue >= 6)) return 0.9;
  return 1;
}
export function sessionRatingSignal(
  userId: string,
  observation: DoseObservation,
): DoseSignal | null {
  if (
    !observation.feedbackExplicit ||
    !observation.activityDate ||
    !observation.feedbackReferenceId
  )
    return null;
  return {
    userId,
    occurrenceKey: `session:${observation.canonicalSessionId}`,
    aliases: [],
    sourceRevisionIds: [observation.feedbackReferenceId],
    kind: 'ratings',
    on: observation.activityDate,
    factor: ratingFactor(observation.effortRpe, observation.fatigue),
  };
}
export function routineRatingSignal(userId: string, routine: RoutineReport): DoseSignal {
  return {
    userId,
    occurrenceKey: `routine:${userId}:${routine.timeZone}:${routine.periodThrough}`,
    aliases: [],
    sourceRevisionIds: [`routine:${routine.id}:${routine.revision}`],
    kind: 'ratings',
    on: routine.periodThrough,
    factor: ratingFactor(routine.usualEffortRpe, routine.currentFatigue),
  };
}
export function latestAdherenceSignal(
  userId: string,
  weeks: DeliveredWeek[],
  asOf: Instant,
  zone: string,
): DoseSignal | null {
  owned(userId, weeks);
  const latest = weeks
    .filter(
      (w) =>
        w.through < monday(localDate(asOf, zone)) &&
        w.opportunities.some((o) => o.prescribedSeconds > 0),
    )
    .sort((a, b) => compareText(b.from, a.from) || compareText(a.id, b.id))[0];
  if (!latest) return null;
  const adherence = weekAdherence(latest);
  return adherence.aMax !== null && adherence.aMax < 0.8
    ? {
        userId,
        occurrenceKey: `adherence:${latest.id}`,
        aliases: [],
        sourceRevisionIds: [`week:${latest.id}`],
        kind: 'adherence',
        on: latest.through,
        factor: 0.8,
      }
    : null;
}

export function emptyDoseControlState(): DoseControlState {
  return {
    revision: 0,
    reference: null,
    lastDeliveryId: null,
    lastDeliveredStrategy: null,
    receipts: [],
    progressionConsumedThrough: null,
    progressionBarrier: null,
    episode: null,
  };
}
function sourceUsable(source: SourceFact | undefined, at: Instant): boolean {
  return (
    !!source &&
    !source.withdrawn &&
    !source.conflicting &&
    (source.expiresAt === null || instant(at) < instant(source.expiresAt))
  );
}
export type DosePreconditions = {
  userId: string;
  controlRevision: number;
  controlHash: string;
  sourceFacts: SourceFact[];
  asOfDate: LocalDate;
  asOf: Instant;
  validThrough: Instant | null;
  timeZone: string;
  engineVersion: typeof ENGINE_VERSION;
  policyVersion: typeof POLICY_VERSION;
};
export function checkDosePreconditions(input: {
  expected: DosePreconditions;
  userId: string;
  state: DoseControlState;
  sources: SourceFact[];
  at: Instant;
  engineVersion: string;
  policyVersion: string;
}): void {
  const e = input.expected;
  requireInput(e.userId === input.userId, 'ACCOUNT_SCOPE_MISMATCH');
  owned(input.userId, input.sources);
  requireInput(
    e.engineVersion === input.engineVersion && e.policyVersion === input.policyVersion,
    'ENGINE_CHANGED',
  );
  requireInput(e.asOfDate === localDate(input.at, e.timeZone), 'LOCAL_DATE_CHANGED');
  requireInput(instant(input.at) >= instant(e.asOf), 'CLOCK_BEFORE_EVALUATION');
  requireInput(
    e.validThrough === null || instant(input.at) <= instant(e.validThrough),
    'DOSE_INPUT_EXPIRED',
  );
  requireInput(
    e.controlRevision === input.state.revision && e.controlHash === stableHash(input.state),
    'DOSE_CONTROL_CHANGED',
  );
  for (const expected of e.sourceFacts) {
    const current = input.sources.find((s) => s.id === expected.id);
    requireInput(
      current && stableHash(current) === stableHash(expected) && sourceUsable(current, input.at),
      'DOSE_SOURCE_CHANGED',
    );
  }
}

export function planResumeEpisode(input: {
  userId: string;
  episodeId: string;
  continuityRevisionId: string;
  lastRunOn: LocalDate;
  observedThrough: LocalDate;
  asOf: Instant;
  timeZone: string;
  historicalAnchor: DoseAnchor | null;
  currentReference?: DoseAnchor | null;
  existing: ResumeEpisode | null;
}): { episode: ResumeEpisode | null; contextRequired: boolean } {
  const age = civilAge(input.lastRunOn, input.asOf, input.timeZone);
  requireInput(age >= 0 && civilAge(input.observedThrough, input.asOf, input.timeZone) >= 0);
  const newerBreak = !!(
    input.existing?.firstDeliveryDate &&
    age > 14 &&
    input.lastRunOn > input.existing.lastRunBeforeBreak &&
    input.lastRunOn >= input.existing.firstDeliveryDate
  );
  if (input.existing && ['closed', 'superseded'].includes(input.existing.state) && !newerBreak)
    return { episode: structuredClone(input.existing), contextRequired: false };
  if (input.existing?.state === 'active' && !newerBreak)
    return { episode: structuredClone(input.existing), contextRequired: false };
  if (civilAge(input.observedThrough, input.asOf, input.timeZone) > 7 || age <= 14)
    return { episode: null, contextRequired: false };
  if (age > 90 || !input.historicalAnchor) return { episode: null, contextRequired: true };
  if (newerBreak)
    requireInput(
      input.currentReference !== null && input.currentReference !== undefined,
      'CURRENT_RESUME_REFERENCE_REQUIRED',
    );
  const factor = age <= 28 ? 0.8 : 0.6;
  const existing = input.existing?.state === 'pending' ? input.existing : null;
  const anchor =
    existing?.anchor ?? (newerBreak ? input.currentReference! : input.historicalAnchor);
  const strongest = existing?.factor === 0.6 ? 0.6 : factor;
  return {
    contextRequired: false,
    episode: {
      id: existing?.id ?? input.episodeId,
      state: 'pending',
      lastRunBeforeBreak: input.lastRunOn,
      observedThrough: input.observedThrough,
      openedFromRevision: input.continuityRevisionId,
      anchor: structuredClone(anchor),
      factor: strongest,
      firstDeliveryId: null,
      firstDeliveryDate: null,
      maxSessionsPerWeek: 3,
      maxSessionSeconds: strongest * anchor.sessionSeconds,
      maxWeekSeconds: strongest * anchor.nominalWeekSeconds,
      closedByWeekIds: [],
    },
  };
}

export type DosePlanInput = {
  userId: string;
  stateUserId: string;
  state: DoseControlState;
  asOf: Instant;
  /** Derived strategy-specific expiry, distinct from existence/revision of an underlying source. */
  validThrough?: Instant | null;
  timeZone: string;
  strategy: ExerciseStrategy;
  provisionalAnchor: DoseAnchor;
  nominalFrequency: number;
  emittedCount: number;
  signals: DoseSignal[];
  /** Identity relations can join receipts even after the associated ratings expire. */
  receiptAliasGroups?: string[][];
  weeks: DeliveredWeek[];
  sourceFacts: SourceFact[];
  requiredSourceIds: string[];
  episode: ResumeEpisode | null;
  /** Null represents no additional limit; unknown sources must be handled before this stage. */
  limits: {
    maxSessionSeconds: number | null;
    maxWeekSeconds: number | null;
    maxSessionsPerWeek: number | null;
  };
  smallerRoutine: { sessionSeconds: number; nominalWeekSeconds: number } | null;
  progressionBlocked: boolean;
};
export type DosePlan = {
  preconditions: DosePreconditions;
  strategy: ExerciseStrategy;
  baseAnchor: DoseAnchor;
  frequency: number;
  emittedCount: number;
  sessionSeconds: number;
  nominalWeekSeconds: number;
  entryCeilingSeconds: number | null;
  maxRpe: 3 | 4;
  controlBounds: ControlBounds;
  adjustment: PrescriptionCommon['adjustment'];
  progressionEligible: boolean;
  actualProgressionCapSeconds: number | null;
  consumedPair: { ids: string[]; through: LocalDate } | null;
  changed: boolean;
  first: boolean;
  firstResume: boolean;
  closingEpisode: boolean;
  episode: ResumeEpisode | null;
  appliedSignals: Array<{ signal: DoseSignal; anchor: DoseAnchor; previous: SignalReceipt[] }>;
  receiptsAfterAliases: SignalReceipt[];
  activeSignalKeys: string[];
  activeSignals: DoseSignal[];
};
export function unifySignalReceiptAliases(
  receipts: readonly SignalReceipt[],
  groups: readonly string[][],
): SignalReceipt[] {
  let result = structuredClone([...receipts]);
  const components: string[][] = [];
  for (const keys of [...groups, ...receipts.map((r) => [r.occurrenceKey, ...r.aliases])]) {
    const matches = components.filter((c) => c.some((key) => keys.includes(key)));
    matches.forEach((c) => components.splice(components.indexOf(c), 1));
    components.push(uniqueSorted([...keys, ...matches.flat()]));
  }
  for (const group of components) {
    const matched = result.filter((r) =>
      [r.occurrenceKey, ...r.aliases].some((key) => group.includes(key)),
    );
    if (matched.length === 0) continue;
    const keys = uniqueSorted([
      ...group,
      ...matched.flatMap((r) => [r.occurrenceKey, ...r.aliases]),
    ]);
    const strongest = [...matched].sort(
      (a, b) =>
        a.strongestAppliedFactor - b.strongestAppliedFactor ||
        compareText(a.occurrenceKey, b.occurrenceKey),
    )[0];
    result = result.filter((r) => !matched.includes(r));
    result.push({
      ...strongest,
      occurrenceKey: keys[0],
      aliases: keys.slice(1),
      sourceRevisionIds: uniqueSorted(matched.flatMap((r) => r.sourceRevisionIds)),
    });
  }
  return result.sort((a, b) => compareText(a.occurrenceKey, b.occurrenceKey));
}
function matchingReceipt(signal: DoseSignal, receipts: SignalReceipt[]): SignalReceipt[] {
  const ids = new Set([signal.occurrenceKey, ...signal.aliases]);
  return receipts.filter((r) => [r.occurrenceKey, ...r.aliases].some((id) => ids.has(id)));
}
function normalizeSignals(signals: DoseSignal[]): DoseSignal[] {
  const groups: DoseSignal[] = [];
  for (const signal of [...signals].sort((a, b) => compareText(a.occurrenceKey, b.occurrenceKey))) {
    const keys = [signal.occurrenceKey, ...signal.aliases];
    const matches = groups.filter((g) =>
      [g.occurrenceKey, ...g.aliases].some((k) => keys.includes(k)),
    );
    const members = [...matches, signal];
    const allKeys = uniqueSorted(members.flatMap((s) => [s.occurrenceKey, ...s.aliases]));
    matches.forEach((m) => groups.splice(groups.indexOf(m), 1));
    groups.push({
      ...signal,
      occurrenceKey: allKeys[0],
      aliases: allKeys.slice(1),
      factor: members.reduce((f, s) => (f < s.factor ? f : s.factor), signal.factor),
      sourceRevisionIds: uniqueSorted(members.flatMap((s) => s.sourceRevisionIds)),
      on: members
        .map((s) => s.on)
        .sort()
        .at(-1)!,
    });
  }
  return groups.sort((a, b) => compareText(a.occurrenceKey, b.occurrenceKey));
}
function toleratedPair(
  weeks: DeliveredWeek[],
  asOf: Instant,
  zone: string,
): DeliveredWeek[] | null {
  const end = addDays(monday(localDate(asOf, zone)), -1);
  const second = weeks.find((w) => w.through === end);
  const first = weeks.find((w) => w.through === addDays(end, -7));
  return first && second && weekAdherence(first).tolerated && weekAdherence(second).tolerated
    ? [first, second]
    : null;
}
function validateAnchor(anchor: DoseAnchor): void {
  requireInput(anchor.id.length > 0 && anchor.sourceFingerprint.length > 0);
  integer(anchor.nominalSessionsPerWeek, 0, 7);
  requireInput(finite(anchor.sessionSeconds) >= 0 && finite(anchor.nominalWeekSeconds) >= 0);
  if (anchor.entryCeilingSeconds !== null) integer(anchor.entryCeilingSeconds, 0, 1200);
}

/** Preview produces caps and commit instructions; it never consumes a signal or fabricates execution. */
export function proposeDose(input: DosePlanInput): DosePlan {
  const { state, asOf, timeZone: zone, strategy } = input;
  requireInput(input.stateUserId === input.userId, 'ACCOUNT_SCOPE_MISMATCH');
  owned(input.userId, [...input.signals, ...input.weeks, ...input.sourceFacts]);
  requireInput(new Set(input.sourceFacts.map((s) => s.id)).size === input.sourceFacts.length);
  input.sourceFacts.forEach((s) => {
    integer(s.revision);
    if (s.expiresAt) instant(s.expiresAt);
  });
  integer(state.revision);
  integer(input.nominalFrequency, 0, 7);
  integer(input.emittedCount, 0, 7);
  requireInput(input.emittedCount <= input.nominalFrequency);
  validateAnchor(input.provisionalAnchor);
  if (state.reference) validateAnchor(state.reference);
  const R = state.reference ?? input.provisionalAnchor;
  const changed =
    state.reference !== null &&
    (state.lastDeliveredStrategy !== strategy ||
      R.nominalSessionsPerWeek !== input.nominalFrequency);
  const episode = input.episode;
  const receiptsAfterAliases = unifySignalReceiptAliases(state.receipts, [
    ...(input.receiptAliasGroups ?? []),
    ...input.signals.map((s) => [s.occurrenceKey, ...s.aliases]),
  ]);
  const episodeApplies = episode !== null && ['pending', 'active'].includes(episode.state);
  const signals = [...input.signals];
  if (episode?.state === 'pending')
    signals.push({
      userId: input.userId,
      kind: 'resume',
      occurrenceKey: `resume:${episode.id}`,
      aliases: [],
      on: localDate(asOf, zone),
      sourceRevisionIds: [episode.openedFromRevision],
      factor: episode.factor,
    });
  const currentSignals = normalizeSignals(
    signals.filter((s) => {
      civil(s.on);
      requireInput([0.6, 0.8, 0.9, 1].includes(s.factor));
      const age = civilAge(s.on, asOf, zone);
      if (age < 0 || (s.kind === 'ratings' && age > 7)) return false;
      for (const id of s.sourceRevisionIds)
        requireInput(
          input.sourceFacts.some((source) => source.id === id),
          'DOSE_SOURCE_UNAVAILABLE',
        );
      return (
        age >= 0 &&
        (s.kind !== 'ratings' || age <= 7) &&
        s.sourceRevisionIds.length > 0 &&
        s.sourceRevisionIds.every((id) =>
          sourceUsable(
            input.sourceFacts.find((f) => f.id === id),
            asOf,
          ),
        )
      );
    }),
  );
  const pair = toleratedPair(input.weeks, asOf, zone);
  const eligiblePair =
    pair &&
    pair.every(
      (w) =>
        (state.progressionConsumedThrough === null || w.from > state.progressionConsumedThrough) &&
        (state.progressionBarrier === null ||
          (w.from > state.progressionBarrier.on &&
            w.controlRevisionAfter >= state.progressionBarrier.controlRevision)),
    );
  const closingEpisode = !!(
    episode?.state === 'active' &&
    episode.firstDeliveryDate &&
    pair &&
    pair.every(
      (w) =>
        w.from > episode.firstDeliveryDate! &&
        (state.progressionConsumedThrough === null || w.from > state.progressionConsumedThrough),
    )
  );
  const G =
    state.reference !== null &&
    strategy !== 'entry' &&
    !episodeApplies &&
    !changed &&
    !input.progressionBlocked &&
    !currentSignals.some((s) => s.factor < 1) &&
    !!eligiblePair;
  let qCap = R.sessionSeconds * (G ? 1.05 : 1);
  let pCap = R.nominalWeekSeconds * (G ? 1.05 : 1);
  let cCap =
    strategy === 'entry'
      ? Math.min(
          input.provisionalAnchor.entryCeilingSeconds ?? 1200,
          R.entryCeilingSeconds ?? input.provisionalAnchor.entryCeilingSeconds ?? 1200,
        )
      : null;
  const appliedSignals: DosePlan['appliedSignals'] = [];
  for (const signal of currentSignals) {
    if (signal.factor === 1) continue;
    const previous = matchingReceipt(signal, receiptsAfterAliases);
    if (
      previous.length &&
      signal.factor >= Math.min(...previous.map((r) => r.strongestAppliedFactor))
    )
      continue;
    const anchor =
      signal.kind === 'resume' && episode?.state === 'pending'
        ? episode.anchor
        : ([...previous].sort(
            (a, b) =>
              a.strongestAppliedFactor - b.strongestAppliedFactor ||
              compareText(a.occurrenceKey, b.occurrenceKey),
          )[0]?.anchor ?? R);
    let q: number;
    let p: number;
    if (anchor.entryCeilingSeconds !== null) {
      const C = Math.floor(signal.factor * anchor.entryCeilingSeconds);
      q = entryDoseSeconds(C);
      p = Math.min(anchor.nominalWeekSeconds, anchor.nominalSessionsPerWeek * q);
      if (cCap !== null) cCap = Math.min(cCap, C);
    } else {
      q = signal.factor * anchor.sessionSeconds;
      p = signal.factor * anchor.nominalWeekSeconds;
    }
    qCap = Math.min(qCap, q);
    pCap = Math.min(pCap, p);
    appliedSignals.push({
      signal,
      anchor: structuredClone(anchor),
      previous: structuredClone(previous),
    });
  }
  const F = Math.min(
    input.nominalFrequency,
    input.limits.maxSessionsPerWeek ?? 7,
    episodeApplies ? episode.maxSessionsPerWeek : 7,
  );
  const n = Math.min(input.emittedCount, F);
  if (input.smallerRoutine) {
    qCap = Math.min(qCap, input.smallerRoutine.sessionSeconds);
    pCap = Math.min(pCap, input.smallerRoutine.nominalWeekSeconds);
  }
  qCap = Math.min(
    qCap,
    input.limits.maxSessionSeconds ?? qCap,
    episodeApplies ? episode.maxSessionSeconds : qCap,
  );
  pCap = Math.min(
    pCap,
    input.limits.maxWeekSeconds ?? pCap,
    episodeApplies ? episode.maxWeekSeconds : pCap,
  );
  if (changed) {
    qCap = Math.min(qCap, R.sessionSeconds);
    pCap = Math.min(pCap, R.nominalWeekSeconds);
  }
  const actualProgressionCapSeconds =
    G && pair && n > 0
      ? 1.05 * Math.min(...pair.map((w) => weekAdherence(w).actualTotalSeconds!))
      : null;
  if (actualProgressionCapSeconds !== null && n > 0) {
    pCap = Math.min(pCap, actualProgressionCapSeconds);
    qCap = Math.min(qCap, actualProgressionCapSeconds / n);
  }
  let sessionSeconds = 0;
  let entryCeilingSeconds: number | null = null;
  let nominalWeekSeconds = 0;
  if (n > 0 && F > 0) {
    if (strategy === 'duration_rpe') {
      sessionSeconds = floor30(Math.min(5400, qCap, pCap / n, 18000 / n));
      nominalWeekSeconds = Math.min(F * sessionSeconds, pCap, 18000);
    } else if (strategy === 'entry') {
      // Search C, not Q(C), to avoid applying reductions to both representations.
      let C = Math.floor(Math.min(cCap ?? 1200, 1200));
      while (C > 0 && (entryDoseSeconds(C) > qCap || n * entryDoseSeconds(C) > pCap)) C--;
      entryCeilingSeconds = C;
      sessionSeconds = entryDoseSeconds(C);
      nominalWeekSeconds = Math.min(F * sessionSeconds, pCap);
    } else {
      sessionSeconds = Math.floor(qCap);
      nominalWeekSeconds = Math.floor(pCap);
    }
  }
  const activeNegative = currentSignals.some((s) => s.factor < 1);
  const reduce =
    sessionSeconds < R.sessionSeconds ||
    nominalWeekSeconds < R.nominalWeekSeconds ||
    (entryCeilingSeconds !== null &&
      R.entryCeilingSeconds !== null &&
      entryCeilingSeconds < R.entryCeilingSeconds);
  const progress = sessionSeconds > R.sessionSeconds || nominalWeekSeconds > R.nominalWeekSeconds;
  const maxRpe =
    activeNegative || episodeApplies || (strategy === 'duration_rpe' && reduce) ? 3 : 4;
  const firstResume = episode?.state === 'pending';
  const first = state.reference === null;
  const adjustment: PrescriptionCommon['adjustment'] = firstResume
    ? 'resume'
    : first
      ? 'initial'
      : reduce
        ? 'reduce'
        : progress
          ? 'progress'
          : 'maintain';
  const requiredIds = uniqueSorted([
    ...input.requiredSourceIds,
    ...currentSignals.flatMap((s) => s.sourceRevisionIds),
    ...((G || closingEpisode) && pair ? pair.map((w) => `week:${w.id}`) : []),
  ]);
  const sourceFacts = requiredIds.map((id) => {
    const fact = input.sourceFacts.find((f) => f.id === id);
    requireInput(sourceUsable(fact, asOf), 'DOSE_SOURCE_UNAVAILABLE');
    return structuredClone(fact!);
  });
  return {
    strategy,
    baseAnchor: structuredClone(R),
    frequency: F,
    emittedCount: n,
    sessionSeconds,
    nominalWeekSeconds,
    entryCeilingSeconds,
    maxRpe,
    controlBounds: {
      maxSessionsPerWeek: F,
      maxSessionSeconds: sessionSeconds,
      maxWeekSeconds: nominalWeekSeconds,
      maxRpe,
    },
    adjustment,
    progressionEligible: G,
    actualProgressionCapSeconds,
    consumedPair:
      (G || closingEpisode) && pair
        ? { ids: pair.map((w) => w.id), through: pair[1].through }
        : null,
    changed,
    first,
    firstResume,
    closingEpisode,
    episode: structuredClone(episode),
    appliedSignals,
    receiptsAfterAliases,
    activeSignalKeys: currentSignals.filter((s) => s.factor < 1).map((s) => s.occurrenceKey),
    activeSignals: currentSignals.filter((s) => s.factor < 1),
    preconditions: {
      userId: input.userId,
      controlRevision: state.revision,
      controlHash: stableHash(state),
      sourceFacts,
      asOfDate: localDate(asOf, zone),
      asOf,
      validThrough: input.validThrough ?? null,
      timeZone: zone,
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
    },
  };
}

export type DeliveryEvent = { id: string; committedAt: Instant; emittedSessionSeconds: number[] };
export type DoseDeliveryReceipt = {
  userId: string;
  deliveryId: string;
  eventHash: string;
  commit: DoseCommit;
  episodeTransitions: ResumeEpisode[];
};
/** A pure proposal for the adapter's atomic transaction. This does not establish a DB lock or lease. */
export function commitDoseDelivery(input: {
  userId: string;
  plan: DosePlan;
  state: DoseControlState;
  sources: SourceFact[];
  event: DeliveryEvent;
  previousReceipt: DoseDeliveryReceipt | null;
  engineVersion: string;
  policyVersion: string;
}): {
  status: 'applied' | 'replayed' | 'no_delivery';
  nextState: DoseControlState;
  receipt: DoseDeliveryReceipt | null;
} {
  const { plan, state, event } = input;
  const eventHash = stableHash({ plan, event });
  if (input.previousReceipt) {
    const receipt = input.previousReceipt;
    requireInput(receipt.userId === input.userId, 'ACCOUNT_SCOPE_MISMATCH');
    requireInput(
      receipt.deliveryId === event.id && receipt.eventHash === eventHash,
      'IDEMPOTENCY_KEY_REUSED',
    );
    return {
      status: 'replayed',
      nextState: structuredClone(state),
      receipt: structuredClone(receipt),
    };
  }
  checkDosePreconditions({
    expected: plan.preconditions,
    userId: input.userId,
    state,
    sources: input.sources,
    at: event.committedAt,
    engineVersion: input.engineVersion,
    policyVersion: input.policyVersion,
  });
  event.emittedSessionSeconds.forEach((s) => integer(s, 1));
  requireInput(
    event.emittedSessionSeconds.length <= plan.emittedCount &&
      event.emittedSessionSeconds.every((s) => s <= plan.sessionSeconds),
  );
  const emitted = event.emittedSessionSeconds.reduce((s, x) => s + x, 0);
  requireInput(emitted <= plan.nominalWeekSeconds);
  if (emitted === 0)
    return { status: 'no_delivery', nextState: structuredClone(state), receipt: null };
  requireInput(event.id !== state.lastDeliveryId, 'DELIVERY_RECEIPT_REQUIRED');
  const next = structuredClone(state);
  next.receipts = structuredClone(plan.receiptsAfterAliases);
  next.revision++;
  const sourceFingerprint = stableHash(plan.preconditions.sourceFacts);
  next.reference = {
    id: stableHash({ userId: input.userId, deliveryId: event.id, sourceFingerprint }),
    nominalSessionsPerWeek: plan.frequency,
    sessionSeconds: plan.sessionSeconds,
    nominalWeekSeconds: plan.nominalWeekSeconds,
    entryCeilingSeconds: plan.entryCeilingSeconds,
    basisIds: plan.preconditions.sourceFacts.map((s) => s.id),
    sourceFingerprint,
  };
  next.lastDeliveryId = event.id;
  next.lastDeliveredStrategy = plan.strategy;
  for (const applied of plan.appliedSignals) {
    const keys = uniqueSorted([
      applied.signal.occurrenceKey,
      ...applied.signal.aliases,
      ...applied.previous.flatMap((r) => [r.occurrenceKey, ...r.aliases]),
    ]);
    next.receipts = next.receipts.filter(
      (r) => !keys.some((k) => [r.occurrenceKey, ...r.aliases].includes(k)),
    );
    next.receipts.push({
      occurrenceKey: keys[0],
      aliases: keys.slice(1),
      sourceRevisionIds: applied.signal.sourceRevisionIds,
      anchor: applied.anchor,
      strongestAppliedFactor: applied.signal.factor,
      firstCommittedDeliveryId: applied.previous[0]?.firstCommittedDeliveryId ?? event.id,
      lastCommittedDeliveryId: event.id,
    });
  }
  next.receipts.sort((a, b) => compareText(a.occurrenceKey, b.occurrenceKey));
  if (plan.consumedPair) next.progressionConsumedThrough = plan.consumedPair.through;
  if (plan.episode) {
    next.episode = structuredClone(plan.episode);
    if (plan.firstResume) {
      next.episode.state = 'active';
      next.episode.firstDeliveryId = event.id;
      next.episode.firstDeliveryDate = localDate(event.committedAt, plan.preconditions.timeZone);
      next.episode.maxSessionsPerWeek = Math.min(3, plan.frequency);
      next.episode.maxSessionSeconds = plan.sessionSeconds;
      next.episode.maxWeekSeconds = plan.nominalWeekSeconds;
    }
    if (plan.closingEpisode) {
      next.episode.state = 'closed';
      next.episode.closedByWeekIds = plan.consumedPair!.ids;
    }
  } else if (next.episode?.state === 'pending') {
    next.episode.state = 'superseded';
  }
  const episodeTransitions: ResumeEpisode[] = [];
  if (
    state.episode &&
    next.episode?.id !== state.episode.id &&
    ['pending', 'active'].includes(state.episode.state)
  )
    episodeTransitions.push({ ...structuredClone(state.episode), state: 'superseded' });
  if (next.episode && stableHash(next.episode) !== stableHash(state.episode))
    episodeTransitions.push(structuredClone(next.episode));
  if (
    plan.first ||
    plan.adjustment === 'reduce' ||
    plan.changed ||
    plan.firstResume ||
    plan.closingEpisode
  )
    next.progressionBarrier = {
      on: localDate(event.committedAt, plan.preconditions.timeZone),
      controlRevision: next.revision,
    };
  const commit: DoseCommit = {
    controlRevisionBefore: state.revision,
    controlRevisionAfter: next.revision,
    anchorId: next.reference.id,
    signalOccurrenceKeys: plan.appliedSignals.map((s) => s.signal.occurrenceKey),
    nominalSessionsPerWeek: plan.frequency,
    nominalWeekSeconds: plan.nominalWeekSeconds,
    emittedWeekSeconds: emitted,
    episodeId: plan.episode?.id ?? null,
  };
  return {
    status: 'applied',
    nextState: next,
    receipt: { userId: input.userId, deliveryId: event.id, eventHash, commit, episodeTransitions },
  };
}
