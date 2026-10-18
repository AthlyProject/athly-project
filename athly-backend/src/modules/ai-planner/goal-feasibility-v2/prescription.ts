import { compareText } from './core';
import {
  civilAge,
  ENGINE_VERSION,
  instant,
  localDate,
  owned,
  POLICY_VERSION,
  requireInput,
  stableHash,
  uniqueSorted,
} from './core';
import type { LocalDate } from './core';
import type {
  ControlBounds,
  DoseAnchor,
  DoseControlState,
  EntryPreference,
  ExerciseStrategy,
  MissingContextField,
  Prescription,
  PrescriptionCommon,
  PrescriptionReason,
  ResumeEpisode,
  RoutineReport,
} from './types';
import type { BaselineInput, BaselineResult } from './baseline';
import { deriveDurationBaseline, historicalResumeAnchor, routineBaseline } from './baseline';
import type { CanonicalSession } from './sessions';
import type { CalendarInput } from './calendar';
import { preliminaryDates, prescriptionDates } from './calendar';
import type { DeliveredWeek, DosePlan, DoseSignal, SourceFact } from './control';
import {
  latestAdherenceSignal,
  planResumeEpisode,
  proposeDose,
  routineRatingSignal,
  sessionRatingSignal,
} from './control';
import type { GoalTarget, ObjectiveEvidence, ObjectivePaceContext, Summary } from './objective';
import { assessGoal, objectivePaceContext } from './objective';
import {
  durationRunSeconds,
  durationTree,
  entryDoseSeconds,
  entryRunSeconds,
  entryTree,
} from './trees';
import type { Segment } from '../../workouts/types/segment.types';

export type PrescriptionInput = {
  baselineInput: BaselineInput;
  entryPreference: EntryPreference;
  stateUserId: string;
  state: DoseControlState;
  contextRevision: number;
  contextSourceId: string;
  objective: ObjectiveEvidence;
  objectiveSourceId: string | null;
  target: GoalTarget;
  calendar: CalendarInput;
  sourceFacts: SourceFact[];
  restrictions: {
    preventsExercise: boolean;
    preventsAttempt: boolean;
    maxSessionSeconds: number | null;
    maxWeekSeconds: number | null;
    maxSessionsPerWeek: number | null;
    sourceIds: string[];
  };
  weeks: DeliveredWeek[];
  /** Historical anchor must be supported by its actual, still-existing sources at lastRunOn. */
  historicalResume: {
    anchor: DoseAnchor;
    routine: RoutineReport | null;
    sessions: CanonicalSession[];
    sourceIds: string[];
  } | null;
  newEpisodeId: string;
  heartRateGuidanceAvailable: boolean;
};
export type DatePaceLimit = {
  date: LocalDate;
  maxSessionSeconds: number;
  maxSessionMeters: number;
  attemptEligible: boolean;
};
export type FrozenPrescription = {
  id: string;
  engineVersion: typeof ENGINE_VERSION;
  policyVersion: typeof POLICY_VERSION;
  prescription: Prescription;
  entryCeilingSeconds: number | null;
  expectedTrees: Array<{ date: LocalDate; segments: Segment[] }>;
  paceDates: DatePaceLimit[];
  target: GoalTarget;
  assessment: Summary;
  objective: ObjectiveEvidence;
  paceContext: ObjectivePaceContext;
  snapshotHash: string;
};
export type PrescriptionResult = {
  prescription: Prescription;
  dosePlan: DosePlan | null;
  frozen: FrozenPrescription | null;
};

export function selectPrescriptionStrategy(input: {
  preventsExercise: boolean;
  preliminaryDates: LocalDate[] | null;
  hasConflict: boolean;
  baseline: BaselineResult;
  entryPreference: EntryPreference;
  lastDeliveredStrategy: ExerciseStrategy | null;
  experience: BaselineInput['experience'];
  episode: ResumeEpisode | null;
  resumeNeedsContext: boolean;
  paceEligible: boolean;
}): { strategy: Prescription['strategy']; missingFields: MissingContextField[] } {
  if (input.preventsExercise) return { strategy: 'paused', missingFields: [] };
  if (input.preliminaryDates === null)
    return { strategy: 'context_required', missingFields: ['availability'] };
  if (input.preliminaryDates.length === 0) return { strategy: 'paused', missingFields: [] };
  if (input.hasConflict)
    return input.baseline.baseline
      ? { strategy: 'duration_rpe', missingFields: [] }
      : { strategy: 'context_required', missingFields: ['resolve_conflict'] };
  if (
    input.entryPreference?.choice === 'entry' ||
    (input.entryPreference === null &&
      (['beginner', 'no_history'].includes(input.experience.level) ||
        input.lastDeliveredStrategy === 'entry'))
  )
    return { strategy: 'entry', missingFields: [] };
  if (input.episode?.state === 'pending') return { strategy: 'duration_rpe', missingFields: [] };
  if (input.resumeNeedsContext)
    return {
      strategy: 'context_required',
      missingFields: ['confirm_current_routine', 'weekly_run_days', 'usual_session_duration'],
    };
  if (input.paceEligible) return { strategy: 'evidence_pace', missingFields: [] };
  if (input.baseline.baseline) return { strategy: 'duration_rpe', missingFields: [] };
  return {
    strategy: 'context_required',
    missingFields: input.baseline.missingFields.length
      ? input.baseline.missingFields
      : ['confirm_current_routine'],
  };
}

function explanation(
  code: PrescriptionReason['code'],
  referenceIds: string[] = [],
  facts: PrescriptionReason['facts'] = {},
): PrescriptionReason {
  return { code, referenceIds: uniqueSorted(referenceIds), facts };
}
function reasonPriority(reason: PrescriptionReason): number {
  const priorities: Partial<Record<PrescriptionReason['code'], number>> = {
    EXISTING_RESTRICTION: 1,
    NO_AVAILABLE_SLOT: 3,
    HISTORY_CONFLICT: 4,
    DUPLICATE_OR_OVERLAP: 4,
    EXPLICIT_BEGINNER: 6,
    NO_HISTORY_CONFIRMED: 6,
    INTERRUPTION_CONFIRMED: 7,
    LONG_INTERRUPTION_NEEDS_CONTEXT: 7,
    PACE_EVIDENCE_AVAILABLE: 8,
    REPORTED_ROUTINE: 9,
    RECORDED_DURATION_ROUTINE: 9,
    OBSERVED_LOWER_BOUND: 9,
    SYNC_UNAVAILABLE_USING_CONTEXT: 9,
    CONTEXT_STALE: 10,
    CONTEXT_MISSING: 10,
  };
  return priorities[reason.code] ?? 12;
}
function anchor(
  reference: Omit<DoseAnchor, 'id' | 'sourceFingerprint'>,
  identity: unknown,
): DoseAnchor {
  const sourceFingerprint = stableHash(identity);
  return { ...reference, sourceFingerprint, id: stableHash({ reference, sourceFingerprint }) };
}

/** Standalone orchestration of pure rules. It is deliberately not called by today's planner. */
export function createPrescription(input: PrescriptionInput): PrescriptionResult {
  const { baselineInput, state, calendar, target, objective } = input;
  owned(baselineInput.userId, [objective, ...input.sourceFacts]);
  requireInput(input.stateUserId === baselineInput.userId, 'ACCOUNT_SCOPE_MISMATCH');
  requireInput(
    calendar.asOf === baselineInput.asOf &&
      calendar.timeZone === baselineInput.timeZone &&
      objective.asOf === baselineInput.asOf &&
      objective.timeZone === baselineInput.timeZone,
  );
  const { asOf, timeZone: zone, userId } = baselineInput;
  const today = localDate(asOf, zone);
  if (input.entryPreference)
    requireInput(instant(input.entryPreference.confirmedAt) <= instant(asOf));
  const actualDates = objective.runs
    .filter((r) => r.volumeEligible && r.startDate !== null)
    .map((r) => localDate(r.startDate!, zone));
  const baseline = deriveDurationBaseline({
    ...baselineInput,
    objectivePracticeDates: uniqueSorted([...baselineInput.objectivePracticeDates, ...actualDates]),
  });
  if (
    baselineInput.experience.level === 'no_history' &&
    baselineInput.experience.declaredAt &&
    objective.runs.some(
      (r) =>
        r.volumeEligible &&
        r.startDate !== null &&
        instant(r.startDate) < instant(baselineInput.experience.declaredAt!),
    )
  ) {
    baseline.hasConflict = true;
    baseline.historyState = 'conflicting';
  }
  const assessed = assessGoal(target, objective).assessment;
  if (objective.conflicts.some((c) => civilAge(localDate(c.to, zone), asOf, zone) <= 42)) {
    baseline.hasConflict = true;
    baseline.historyState = 'conflicting';
  }
  const pace = objectivePaceContext(objective, target);
  const preliminary = preliminaryDates(calendar);
  let episode =
    state.episode && ['pending', 'active'].includes(state.episode.state)
      ? structuredClone(state.episode)
      : null;
  let resumeNeedsContext = false;
  if (
    baseline.continuityUsable &&
    baseline.interruptionDays !== null &&
    baseline.interruptionDays > 14 &&
    baselineInput.continuity?.lastRunOn
  ) {
    const historical = input.historicalResume;
    const historicalAnchor = historical
      ? historicalResumeAnchor({
          userId,
          lastRunOn: baselineInput.continuity.lastRunOn,
          timeZone: zone,
          routine: historical.routine,
          sessions: historical.sessions,
          reference: historical.anchor,
          existingSourceIds: input.sourceFacts.filter((s) => !s.withdrawn).map((s) => s.id),
          conflictingSourceIds: input.sourceFacts.filter((s) => s.conflicting).map((s) => s.id),
        })
      : null;
    const planned = planResumeEpisode({
      userId,
      episodeId: input.newEpisodeId,
      continuityRevisionId: `continuity:${baselineInput.continuity.id}:${baselineInput.continuity.revision}`,
      lastRunOn: baselineInput.continuity.lastRunOn,
      observedThrough: baselineInput.continuity.observedThrough,
      asOf,
      timeZone: zone,
      historicalAnchor,
      currentReference: state.reference,
      existing: episode ?? state.episode,
    });
    episode =
      planned.episode && ['pending', 'active'].includes(planned.episode.state)
        ? planned.episode
        : null;
    resumeNeedsContext =
      planned.contextRequired && (baseline.interruptionDays <= 90 || baseline.baseline === null);
  } else if (episode?.state === 'pending' && !baseline.continuityUsable) episode = null;
  if (
    episode?.state === 'active' &&
    baseline.baseline === null &&
    input.historicalResume &&
    civilAge(episode.lastRunBeforeBreak, asOf, zone) <= 90
  ) {
    const historical = historicalResumeAnchor({
      userId,
      lastRunOn: episode.lastRunBeforeBreak,
      timeZone: zone,
      routine: input.historicalResume.routine,
      sessions: input.historicalResume.sessions,
      reference: input.historicalResume.anchor,
      existingSourceIds: input.sourceFacts.filter((s) => !s.withdrawn).map((s) => s.id),
      conflictingSourceIds: input.sourceFacts.filter((s) => s.conflicting).map((s) => s.id),
    });
    if (historical && state.reference) {
      baseline.baseline = {
        source: 'mixed_sessions',
        referenceIds: uniqueSorted([...input.historicalResume.sourceIds, ...historical.basisIds]),
        referenceFrom: input.historicalResume.routine?.periodFrom ?? episode.lastRunBeforeBreak,
        referenceThrough: episode.lastRunBeforeBreak,
        frequencyDays: Math.min(3, state.reference.nominalSessionsPerWeek),
        sessionSeconds: state.reference.sessionSeconds,
        nominalWeekSeconds: state.reference.nominalWeekSeconds,
      };
      baseline.source = 'preserved_reference';
    }
  }
  const selected = selectPrescriptionStrategy({
    preventsExercise: input.restrictions.preventsExercise,
    preliminaryDates: preliminary,
    hasConflict: baseline.hasConflict,
    baseline,
    entryPreference: input.entryPreference,
    lastDeliveredStrategy: state.lastDeliveredStrategy,
    experience: baselineInput.experience,
    episode,
    resumeNeedsContext,
    paceEligible: pace.eligible,
  });
  const reasons: PrescriptionReason[] = [];
  if (baseline.hasConflict)
    reasons.push(
      explanation(
        'HISTORY_CONFLICT',
        uniqueSorted([
          ...baselineInput.conflicts.flatMap((c) => c.memberIds),
          ...objective.conflicts.flatMap((c) => c.evidenceIds),
        ]),
      ),
    );
  const common: PrescriptionCommon = {
    schemaVersion: 1,
    policyVersion: POLICY_VERSION,
    controlRevision: state.revision,
    contextRevision: input.contextRevision,
    episodeId: episode?.id ?? null,
    controlBounds: null,
    entryPreference: structuredClone(input.entryPreference),
    asOf,
    timeZone: zone,
    experience: structuredClone(baselineInput.experience),
    historyState: baseline.historyState,
    goalSupport: assessed.current,
    baseline: structuredClone(baseline.baseline),
    reference: state.reference ? structuredClone(state.reference) : null,
    adjustment: 'none',
    reasons,
    sessions: [],
  };
  const inactive = (
    strategy: 'paused' | 'context_required',
    fields: MissingContextField[],
  ): PrescriptionResult => {
    const prescription: Prescription =
      strategy === 'paused'
        ? {
            ...common,
            strategy,
            delivery: 'no_sessions',
            missingFields: [],
            attemptEligible: false,
            bounds: null,
            reasons: [
              explanation(
                input.restrictions.preventsExercise ? 'EXISTING_RESTRICTION' : 'NO_AVAILABLE_SLOT',
              ),
            ],
          }
        : {
            ...common,
            strategy,
            delivery: 'context_required',
            missingFields: fields,
            attemptEligible: false,
            bounds: null,
            reasons: [explanation(baseline.hasConflict ? 'HISTORY_CONFLICT' : 'CONTEXT_MISSING')],
          };
    return { prescription, dosePlan: null, frozen: null };
  };
  if (selected.strategy === 'paused' || selected.strategy === 'context_required')
    return inactive(selected.strategy, selected.missingFields);
  const strategy = selected.strategy;
  let frequency: number;
  let provisional: DoseAnchor;
  let paceDates: DatePaceLimit[] = [];
  let paceWeekMeters: number | null = null;
  const requiredSourceIds = [input.contextSourceId, ...input.restrictions.sourceIds];
  if (baseline.source === 'complete_inventory' && baselineInput.inventory)
    requiredSourceIds.push(
      `inventory:${baselineInput.inventory.id}:${baselineInput.inventory.revision}`,
    );
  if (baseline.continuityUsable && baselineInput.continuity)
    requiredSourceIds.push(
      `continuity:${baselineInput.continuity.id}:${baselineInput.continuity.revision}`,
    );
  const withoutObjective = deriveDurationBaseline(baselineInput);
  if (
    baseline.baseline !== null &&
    withoutObjective.baseline === null &&
    actualDates.length > 0 &&
    input.objectiveSourceId !== null
  )
    requiredSourceIds.push(input.objectiveSourceId);
  if (strategy === 'entry') {
    frequency = 3;
    const C = pace.H !== null && pace.H > 0 ? Math.min(1200, Math.floor(1.1 * pace.H)) : 1200;
    const q = entryDoseSeconds(C);
    if (pace.H !== null && input.objectiveSourceId) requiredSourceIds.push(input.objectiveSourceId);
    provisional = anchor(
      {
        nominalSessionsPerWeek: frequency,
        sessionSeconds: q,
        nominalWeekSeconds: frequency * q,
        entryCeilingSeconds: C,
        basisIds: [...requiredSourceIds],
      },
      { userId, H: pace.H, contextRevision: input.contextRevision },
    );
    if (['beginner', 'no_history'].includes(baselineInput.experience.level))
      reasons.push(
        explanation(
          baselineInput.experience.level === 'no_history'
            ? 'NO_HISTORY_CONFIRMED'
            : 'EXPLICIT_BEGINNER',
        ),
      );
  } else if (strategy === 'duration_rpe') {
    const b = baseline.baseline;
    if (episode?.state === 'pending') {
      frequency = Math.min(3, episode.anchor.nominalSessionsPerWeek);
      provisional = structuredClone(episode.anchor);
      requiredSourceIds.push(
        episode.openedFromRevision,
        ...episode.anchor.basisIds,
        ...(input.historicalResume?.sourceIds ?? []),
      );
    } else {
      if (!b) return inactive('context_required', ['confirm_current_routine']);
      frequency = b.frequencyDays;
      provisional = anchor(
        {
          nominalSessionsPerWeek: frequency,
          sessionSeconds: b.sessionSeconds,
          nominalWeekSeconds: b.nominalWeekSeconds,
          entryCeilingSeconds: null,
          basisIds: b.referenceIds,
        },
        b,
      );
      requiredSourceIds.push(...b.referenceIds);
    }
    reasons.push(
      explanation(
        baseline.source === 'reported_routine'
          ? 'REPORTED_ROUTINE'
          : baseline.source === 'observed_lower_bound'
            ? 'OBSERVED_LOWER_BOUND'
            : 'RECORDED_DURATION_ROUTINE',
        b?.referenceIds ?? provisional.basisIds,
      ),
    );
    if (!pace.eligible) reasons.push(explanation('SYNC_UNAVAILABLE_USING_CONTEXT'));
  } else {
    requireInput(
      pace.eligible &&
        pace.maxSessionSeconds !== null &&
        pace.maxSessionMeters !== null &&
        pace.maxWeekMeters !== null &&
        pace.trainingIndex !== null &&
        pace.zones !== null,
    );
    requireInput(input.objectiveSourceId !== null);
    requiredSourceIds.push(input.objectiveSourceId);
    const objectiveSource = input.sourceFacts.find((s) => s.id === input.objectiveSourceId);
    requireInput(objectiveSource && objective.capturedAt !== null);
    const nominalDates = preliminaryDates(calendar, true)!;
    frequency = nominalDates.length;
    const attempt =
      !episode &&
      assessed.current === 'supported' &&
      objective.fresh &&
      target.eventDate !== null &&
      target.eventDate > today &&
      nominalDates.includes(target.eventDate) &&
      !input.restrictions.preventsAttempt;
    paceDates = nominalDates.map((date) => ({
      date,
      attemptEligible: attempt && date === target.eventDate,
      maxSessionSeconds:
        attempt && date === target.eventDate
          ? target.timeSeconds !== null
            ? target.timeSeconds + 1200
            : (target.distanceMeters! / 1000) * pace.zones!.easyPaceMax + 1200
          : pace.maxSessionSeconds!,
      maxSessionMeters:
        attempt && date === target.eventDate
          ? target.distanceMeters! + Math.min(2000, 0.1 * target.distanceMeters!)
          : pace.maxSessionMeters!,
    }));
    paceDates = paceDates.map((limit) =>
      limit.maxSessionMeters > 0 ? limit : { ...limit, maxSessionSeconds: 0 },
    );
    const A = pace.preparationAverageMeters;
    paceWeekMeters =
      attempt && A !== null
        ? target.distanceMeters! + Math.min(0.2 * A, Math.max(0, 1.1 * A - target.distanceMeters!))
        : pace.maxWeekMeters;
    provisional = anchor(
      {
        nominalSessionsPerWeek: frequency,
        sessionSeconds: Math.max(0, ...paceDates.map((d) => d.maxSessionSeconds)),
        nominalWeekSeconds: paceDates.reduce((s, d) => s + d.maxSessionSeconds, 0),
        entryCeilingSeconds: null,
        basisIds: [input.objectiveSourceId],
      },
      { evidenceHash: objective.evidenceHash, paceDates },
    );
    reasons.push(explanation('PACE_EVIDENCE_AVAILABLE', [input.objectiveSourceId]));
  }
  // Frequency increases require an explicit routine confirmation; all other changes preserve it.
  const routine = baselineInput.routine;
  const explicitFrequency =
    routine &&
    routine.timeZone === zone &&
    routine.weeklyRunDays !== null &&
    civilAge(routine.periodThrough, asOf, zone) <= 28 &&
    routine.weeklyRunDays > 0;
  if (
    state.reference &&
    strategy === 'duration_rpe' &&
    frequency > state.reference.nominalSessionsPerWeek &&
    !explicitFrequency
  )
    frequency = state.reference.nominalSessionsPerWeek;
  const maxSessions = Math.min(
    frequency,
    input.restrictions.maxSessionsPerWeek ?? 7,
    episode ? episode.maxSessionsPerWeek : 7,
  );
  const dates = prescriptionDates(calendar, strategy, maxSessions)!;
  if (dates.length === 0) return inactive('paused', []);
  const signals: DoseSignal[] = baselineInput.sessions
    .map((s) => {
      const signal = sessionRatingSignal(userId, s.observation);
      return signal ? { ...signal, aliases: s.memberIds.map((id) => `session:${id}`) } : null;
    })
    .filter((s): s is DoseSignal => s !== null);
  if (routine) signals.push(routineRatingSignal(userId, routine));
  const adherence = latestAdherenceSignal(userId, input.weeks, asOf, zone);
  if (adherence) signals.push(adherence);
  const smaller = routine ? routineBaseline(routine, asOf, zone) : null;
  const controlReference = state.reference ?? provisional;
  const smallerRoutine =
    smaller &&
    state.reference !== null &&
    (smaller.sessionSeconds < controlReference.sessionSeconds ||
      smaller.nominalWeekSeconds < controlReference.nominalWeekSeconds)
      ? smaller
      : null;
  if (smallerRoutine) requiredSourceIds.push(...smallerRoutine.referenceIds);
  let plan = proposeDose({
    userId,
    stateUserId: input.stateUserId,
    state,
    asOf,
    validThrough:
      strategy === 'evidence_pace' && objective.capturedAt !== null
        ? new Date(instant(objective.capturedAt) + 7 * 86400000).toISOString()
        : null,
    timeZone: zone,
    strategy,
    provisionalAnchor: provisional,
    nominalFrequency: frequency,
    emittedCount: dates.length,
    signals,
    receiptAliasGroups: baselineInput.sessions.map((s) => s.memberIds.map((id) => `session:${id}`)),
    weeks: input.weeks,
    sourceFacts: input.sourceFacts,
    requiredSourceIds: uniqueSorted(requiredSourceIds),
    episode,
    limits: {
      maxSessionSeconds: Math.min(
        strategy === 'duration_rpe' ? 5400 : provisional.sessionSeconds,
        input.restrictions.maxSessionSeconds ??
          (strategy === 'duration_rpe' ? 5400 : provisional.sessionSeconds),
      ),
      maxWeekSeconds: Math.min(
        strategy === 'duration_rpe' ? 18000 : provisional.nominalWeekSeconds,
        input.restrictions.maxWeekSeconds ??
          (strategy === 'duration_rpe' ? 18000 : provisional.nominalWeekSeconds),
      ),
      maxSessionsPerWeek: maxSessions,
    },
    smallerRoutine: smallerRoutine
      ? {
          sessionSeconds: smallerRoutine.sessionSeconds,
          nominalWeekSeconds: smallerRoutine.nominalWeekSeconds,
        }
      : null,
    progressionBlocked: baseline.hasConflict || input.restrictions.preventsExercise,
  });
  // A new baseline supplies initial dose; a larger routine cannot bypass the control reference.
  const q = plan.sessionSeconds;
  const count = Math.min(dates.length, plan.emittedCount);
  const activeDates = dates.slice(0, count);
  const controlBounds: ControlBounds = plan.controlBounds;
  common.controlBounds = controlBounds;
  common.adjustment = plan.adjustment;
  common.reference = {
    nominalSessionsPerWeek: plan.frequency,
    sessionSeconds: q,
    nominalWeekSeconds: plan.nominalWeekSeconds,
    basisIds: plan.preconditions.sourceFacts.map((s) => s.id),
    entryCeilingSeconds: plan.entryCeilingSeconds,
  };
  if (plan.changed) reasons.push(explanation('MODE_CHANGED_HOLD'));
  if (plan.progressionEligible)
    reasons.push(
      explanation(
        plan.actualProgressionCapSeconds !== null &&
          plan.actualProgressionCapSeconds < 1.05 * plan.baseAnchor.nominalWeekSeconds
          ? 'ACTUAL_DURATION_CEILING'
          : q > plan.baseAnchor.sessionSeconds
            ? 'TWO_TOLERATED_WEEKS'
            : 'ROUNDING_LIMIT',
        plan.consumedPair?.ids ?? [],
        { actualCapSeconds: plan.actualProgressionCapSeconds },
      ),
    );
  for (const signal of plan.activeSignals) {
    if (signal.kind === 'adherence')
      reasons.push(explanation('LOW_ADHERENCE', signal.sourceRevisionIds));
    if (signal.kind === 'ratings') {
      const keys = [signal.occurrenceKey, ...signal.aliases];
      const observations = baselineInput.sessions
        .filter((s) => keys.includes(`session:${s.id}`))
        .map((s) => s.observation);
      const routineApplies =
        routine !== null && keys.includes(routineRatingSignal(userId, routine).occurrenceKey);
      const efforts = [
        ...observations.map((o) => o.effortRpe),
        ...(routineApplies ? [routine.usualEffortRpe] : []),
      ];
      const fatigues = [
        ...observations.map((o) => o.fatigue),
        ...(routineApplies ? [routine.currentFatigue] : []),
      ];
      if (efforts.some((v) => v !== null && v >= 7))
        reasons.push(explanation('HIGH_EFFORT', signal.sourceRevisionIds));
      if (fatigues.some((v) => v !== null && v >= 6))
        reasons.push(explanation('HIGH_FATIGUE', signal.sourceRevisionIds));
    }
  }
  if (plan.firstResume) reasons.push(explanation('INTERRUPTION_CONFIRMED'));
  if (q === 0) reasons.push(explanation('BELOW_DURATION_QUANTUM'));
  let prescription: Prescription;
  const expectedTrees: FrozenPrescription['expectedTrees'] = [];
  if (strategy === 'evidence_pace') {
    paceDates = paceDates.map((d) => ({
      ...d,
      maxSessionSeconds: Math.floor(Math.min(d.maxSessionSeconds, q)),
      attemptEligible: d.attemptEligible && !episode,
    }));
    // Preserve asymmetric per-date ceilings. There is no duration-only quantum or absolute cap here.
    const nominalWeek = Math.floor(
      Math.min(
        plan.nominalWeekSeconds,
        paceDates.reduce((s, d) => s + d.maxSessionSeconds, 0),
      ),
    );
    plan = {
      ...plan,
      nominalWeekSeconds: nominalWeek,
      controlBounds: {
        ...controlBounds,
        maxWeekSeconds: nominalWeek,
        maxRpe: plan.maxRpe === 3 ? 3 : assessed.current === 'supported' ? null : 4,
      },
    };
    common.controlBounds = plan.controlBounds;
    common.reference = { ...common.reference, nominalWeekSeconds: nominalWeek };
    let remaining = nominalWeek;
    common.sessions = activeDates
      .map((date) => {
        const limit = paceDates.find((d) => d.date === date)!;
        const seconds = Math.min(limit.maxSessionSeconds, remaining);
        remaining -= seconds;
        return { date, durationSeconds: seconds, maxRunSeconds: seconds };
      })
      .filter((s) => s.durationSeconds > 0);
    prescription = {
      ...common,
      strategy,
      delivery: common.sessions.length ? 'ready' : 'no_sessions',
      missingFields: [],
      intensity: assessed.current === 'supported' ? 'normal' : 'easy',
      guidance: input.heartRateGuidanceAvailable ? 'pace_heart_rate_and_rpe' : 'pace_and_rpe',
      attemptEligible: paceDates.some(
        (d) => d.attemptEligible && common.sessions.some((s) => s.date === d.date),
      ),
      bounds: {
        kind: 'evidence',
        trainingIndex: pace.trainingIndex!,
        maxSessionsPerWeek: maxSessions,
        maxSessionSeconds: q,
        maxWeekSeconds: nominalWeek,
        maxSessionMeters: Math.max(0, ...paceDates.map((d) => d.maxSessionMeters)),
        maxWeekMeters: paceWeekMeters!,
      },
    };
  } else {
    const runSeconds =
      strategy === 'entry' ? entryRunSeconds(plan.entryCeilingSeconds!) : durationRunSeconds(q);
    common.sessions =
      q > 0
        ? activeDates.map((date) => ({ date, durationSeconds: q, maxRunSeconds: runSeconds }))
        : [];
    for (const date of activeDates)
      if (q > 0)
        expectedTrees.push({
          date,
          segments:
            strategy === 'entry'
              ? entryTree(plan.entryCeilingSeconds!, plan.maxRpe)
              : durationTree(q, plan.maxRpe, input.heartRateGuidanceAvailable),
        });
    const bounds = {
      kind: 'duration_only' as const,
      maxSessionsPerWeek: maxSessions,
      maxSessionSeconds: q,
      maxWeekSeconds: plan.nominalWeekSeconds,
      maxRunSecondsPerSession: runSeconds,
      maxRunSecondsPerWeek: Math.min(
        strategy === 'entry' ? 540 : plan.nominalWeekSeconds,
        maxSessions * runSeconds,
      ),
      maxRpe: plan.maxRpe,
      maxWalkRpe: 3 as const,
      maxSessionMeters: null,
      maxWeekMeters: null,
    };
    prescription =
      strategy === 'entry'
        ? {
            ...common,
            strategy,
            delivery: q > 0 ? 'ready' : 'no_sessions',
            missingFields: [],
            guidance: 'rpe',
            attemptEligible: false,
            bounds,
          }
        : {
            ...common,
            strategy,
            delivery: q > 0 ? 'ready' : 'no_sessions',
            missingFields: [],
            guidance: input.heartRateGuidanceAvailable ? 'heart_rate_and_rpe' : 'rpe',
            attemptEligible: false,
            bounds,
          };
  }
  reasons.sort(
    (a, b) =>
      reasonPriority(a) - reasonPriority(b) ||
      compareText(a.code, b.code) ||
      compareText(stableHash(a), stableHash(b)),
  );
  const snapshot = {
    engineVersion: ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
    prescription,
    entryCeilingSeconds: plan.entryCeilingSeconds,
    expectedTrees,
    paceDates,
    target: structuredClone(target),
    assessment: assessed,
    objective: structuredClone(objective),
    paceContext: pace,
  };
  const snapshotHash = stableHash(snapshot);
  return { prescription, dosePlan: plan, frozen: { ...snapshot, snapshotHash, id: snapshotHash } };
}
