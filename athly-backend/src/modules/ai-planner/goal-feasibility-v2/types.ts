import type { Instant, LocalDate, Revision } from './core';

export type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type GoalSupport = 'supported' | 'not_supported' | 'insufficient_data' | 'unavailable';
export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type ExperienceLevel = 'no_history' | 'beginner' | 'experienced' | 'unknown';
export type ExperienceContext = {
  level: ExperienceLevel;
  source: 'explicit_context' | 'legacy_assessment' | 'unknown';
  declaredAt: Instant | null;
};
export type HistoryState = 'none_confirmed' | 'recent' | 'interrupted' | 'unknown' | 'conflicting';
export type DurationBasis = 'active' | 'elapsed' | 'unknown';
export type CompletionClaim = 'done' | 'partial' | 'not_started' | 'unknown';
export type DoseSource =
  | 'healthkit_workout'
  | 'athly_timer'
  | 'confirmed_import'
  | 'user_report'
  | 'legacy_unknown';
export type DoseProvenance = 'recorded' | 'reported' | 'unknown';
export type ActivityKind = 'running' | 'run_walk' | 'walking' | 'unknown';
export type EntryPreference = null | {
  choice: 'entry' | 'use_current_routine';
  confirmedAt: Instant;
};
export type RoutineInput = {
  timeZone: string;
  periodFrom: LocalDate;
  periodThrough: LocalDate;
  weeklyRunDays: number | null;
  usualSessionSeconds: number | null;
  usualEffortRpe: Rpe | null;
  currentFatigue: Rpe | null;
};
export type ContinuityInput = {
  timeZone: string;
  observedThrough: LocalDate;
  lastRunOn: LocalDate | null;
};
export type RevisionState<T> = {
  revision: Revision;
  value: T | null;
  confirmedAt: Instant | null;
  withdrawnAt: Instant | null;
};
export type RoutineReport = RoutineInput & {
  id: string;
  revision: Revision;
  origin: 'reported';
  confirmedAt: Instant;
};
export type ContinuityReport = ContinuityInput & {
  id: string;
  revision: Revision;
  origin: 'reported';
  confirmedAt: Instant;
};
export type SessionInput = {
  timeZone: string;
  activityDate: LocalDate | null;
  startedAt: Instant | null;
  endedAt: Instant | null;
  activityKind: ActivityKind;
  durationSeconds: number | null;
  durationBasis: DurationBasis;
  completion: CompletionClaim;
  effortRpe: Rpe | null;
  fatigue: Rpe | null;
  linkedActivityKey: string | null;
};
export type TimerCaptureInput = {
  timeZone: string;
  startedAt: Instant;
  endedAt: Instant;
  activityKind: Exclude<ActivityKind, 'unknown'>;
  activeSeconds: number;
  pauses: Array<{ startedAt: Instant; endedAt: Instant }>;
};
export type DeclarationHead = {
  sessionKey: string;
  declarationRevision: Revision;
  acceptedSequence: number;
  withdrawn: boolean;
};
export type DurationCandidate = {
  id: string;
  sourceRef: string;
  sourceRevision: Revision;
  sessionId: string;
  basis: DurationBasis;
  seconds: number | null;
  provenance: DoseProvenance;
  source: DoseSource;
  withdrawn: boolean;
};
export type CanonicalDuration = {
  activeSeconds: number | null;
  candidateId: string | null;
  provenance: DoseProvenance;
  state: 'usable' | 'missing' | 'conflicting';
  inputsHash: string;
  resolutionId: string | null;
};
export type DoseObservation = {
  duration: CanonicalDuration;
  feedbackReferenceId: string | null;
  canonicalSessionId: string;
  sessionKey: string;
  workoutId: string | null;
  source: DoseSource;
  provenance: DoseProvenance;
  activityDate: LocalDate | null;
  activityKind: ActivityKind;
  activeSeconds: number | null;
  completion: CompletionClaim;
  effortRpe: Rpe | null;
  fatigue: Rpe | null;
  feedbackExplicit: boolean;
  referenceIds: string[];
};
export type DurationBaseline = {
  source: 'reported_routine' | 'recorded_sessions' | 'reported_sessions' | 'mixed_sessions';
  referenceIds: string[];
  referenceFrom: LocalDate;
  referenceThrough: LocalDate;
  frequencyDays: number;
  sessionSeconds: number;
  nominalWeekSeconds: number;
};
export type DoseReference = {
  nominalSessionsPerWeek: number;
  sessionSeconds: number;
  nominalWeekSeconds: number;
  basisIds: string[];
  entryCeilingSeconds: number | null;
};
export type DoseAnchor = DoseReference & { id: string; sourceFingerprint: string };
export type SignalReceipt = {
  occurrenceKey: string;
  aliases: string[];
  sourceRevisionIds: string[];
  anchor: DoseAnchor;
  strongestAppliedFactor: 0.6 | 0.8 | 0.9 | 1;
  firstCommittedDeliveryId: string;
  lastCommittedDeliveryId: string;
};
export type ResumeEpisode = {
  id: string;
  state: 'pending' | 'active' | 'closed' | 'superseded';
  lastRunBeforeBreak: LocalDate;
  observedThrough: LocalDate;
  openedFromRevision: string;
  anchor: DoseAnchor;
  factor: 0.6 | 0.8;
  firstDeliveryId: string | null;
  firstDeliveryDate: LocalDate | null;
  maxSessionsPerWeek: number;
  maxSessionSeconds: number;
  maxWeekSeconds: number;
  closedByWeekIds: string[];
};
export type ExerciseStrategy = 'entry' | 'duration_rpe' | 'evidence_pace';
export type DoseControlState = {
  progressionBarrier: { on: LocalDate; controlRevision: Revision } | null;
  revision: Revision;
  reference: DoseAnchor | null;
  lastDeliveryId: string | null;
  lastDeliveredStrategy: ExerciseStrategy | null;
  receipts: SignalReceipt[];
  progressionConsumedThrough: LocalDate | null;
  episode: ResumeEpisode | null;
};
export type DoseCommit = {
  controlRevisionBefore: Revision;
  controlRevisionAfter: Revision;
  anchorId: string;
  signalOccurrenceKeys: string[];
  nominalSessionsPerWeek: number;
  nominalWeekSeconds: number;
  emittedWeekSeconds: number;
  episodeId: string | null;
};
export type PrescriptionReasonCode =
  | 'EXPLICIT_BEGINNER'
  | 'NO_HISTORY_CONFIRMED'
  | 'REPORTED_ROUTINE'
  | 'RECORDED_DURATION_ROUTINE'
  | 'OBSERVED_LOWER_BOUND'
  | 'PACE_EVIDENCE_AVAILABLE'
  | 'PACE_EVIDENCE_MISSING'
  | 'SYNC_UNAVAILABLE_USING_CONTEXT'
  | 'CONTEXT_MISSING'
  | 'CONTEXT_STALE'
  | 'HISTORY_CONFLICT'
  | 'DUPLICATE_OR_OVERLAP'
  | 'INTERRUPTION_CONFIRMED'
  | 'LONG_INTERRUPTION_NEEDS_CONTEXT'
  | 'FEEDBACK_MISSING'
  | 'PARTIAL_EXECUTION'
  | 'LOW_ADHERENCE'
  | 'HIGH_EFFORT'
  | 'HIGH_FATIGUE'
  | 'TWO_TOLERATED_WEEKS'
  | 'ACTUAL_DURATION_CEILING'
  | 'MODE_CHANGED_HOLD'
  | 'NO_AVAILABLE_SLOT'
  | 'EXISTING_RESTRICTION'
  | 'ABSOLUTE_DURATION_CAP'
  | 'ROUNDING_LIMIT'
  | 'BELOW_DURATION_QUANTUM';
export type PrescriptionReason = {
  code: PrescriptionReasonCode;
  referenceIds: string[];
  facts: Record<string, number | string | boolean | null>;
};
export type MissingContextField =
  | 'experience_or_routine'
  | 'weekly_run_days'
  | 'usual_session_duration'
  | 'last_run_date'
  | 'duration_basis'
  | 'confirm_current_routine'
  | 'resolve_conflict'
  | 'availability';
export type SessionBudget = { date: LocalDate; durationSeconds: number; maxRunSeconds: number };
export type ControlBounds = {
  maxSessionsPerWeek: number;
  maxSessionSeconds: number;
  maxWeekSeconds: number;
  maxRpe: 3 | 4 | null;
};
export type DurationBounds = {
  kind: 'duration_only';
  maxSessionsPerWeek: number;
  maxSessionSeconds: number;
  maxWeekSeconds: number;
  maxRunSecondsPerSession: number;
  maxRunSecondsPerWeek: number;
  maxRpe: 3 | 4;
  maxWalkRpe: 3;
  maxSessionMeters: null;
  maxWeekMeters: null;
};
export type PaceBounds = {
  kind: 'evidence';
  trainingIndex: number;
  maxSessionsPerWeek: number;
  maxSessionSeconds: number;
  maxWeekSeconds: number;
  maxSessionMeters: number;
  maxWeekMeters: number;
};
export type PrescriptionCommon = {
  controlRevision: Revision;
  episodeId: string | null;
  controlBounds: ControlBounds | null;
  entryPreference: EntryPreference;
  schemaVersion: 1;
  policyVersion: 'duration-rpe/1.0.0';
  contextRevision: number;
  asOf: Instant;
  timeZone: string;
  experience: ExperienceContext;
  historyState: HistoryState;
  goalSupport: GoalSupport;
  baseline: DurationBaseline | null;
  reference: DoseReference | null;
  adjustment: 'none' | 'initial' | 'maintain' | 'reduce' | 'progress' | 'resume';
  reasons: PrescriptionReason[];
  sessions: SessionBudget[];
};
export type Prescription = PrescriptionCommon &
  (
    | {
        strategy: 'context_required';
        delivery: 'context_required';
        missingFields: MissingContextField[];
        attemptEligible: false;
        bounds: null;
      }
    | {
        strategy: 'paused';
        delivery: 'no_sessions';
        missingFields: [];
        attemptEligible: false;
        bounds: null;
      }
    | {
        strategy: 'entry';
        delivery: 'ready' | 'no_sessions';
        missingFields: [];
        guidance: 'rpe';
        attemptEligible: false;
        bounds: DurationBounds;
      }
    | {
        strategy: 'duration_rpe';
        delivery: 'ready' | 'no_sessions';
        missingFields: [];
        guidance: 'rpe' | 'heart_rate_and_rpe';
        attemptEligible: false;
        bounds: DurationBounds;
      }
    | {
        strategy: 'evidence_pace';
        delivery: 'ready' | 'no_sessions';
        missingFields: [];
        intensity: 'easy' | 'normal';
        guidance: 'pace_and_rpe' | 'pace_heart_rate_and_rpe';
        attemptEligible: boolean;
        bounds: PaceBounds;
      }
  );
