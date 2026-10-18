import type { ObjectiveCapture, ObjectiveRunInput, GoalTarget } from './objective';
import { normalizeObjectiveEvidence } from './objective';
import type { SessionDeclaration, DurationSource } from './sessions';
import type { DoseAnchor, DoseControlState, RoutineReport, SessionInput } from './types';
import type { PrescriptionInput } from './prescription';
import type { DeliveredWeek, DosePlanInput, SourceFact } from './control';
import { emptyDoseControlState } from './control';

export const USER = 'account-a';
export const ZONE = 'America/Sao_Paulo';
export const AS_OF = '2026-10-16T12:00:00Z';
export const GOAL: GoalTarget = {
  modality: 'running',
  distanceMeters: 21097.5,
  timeSeconds: 5400,
  eventDate: '2026-10-22',
  timeZone: ZONE,
};
export const ROUTINE: RoutineReport = {
  id: 'routine-1',
  revision: 1,
  origin: 'reported',
  timeZone: ZONE,
  periodFrom: '2026-10-02',
  periodThrough: '2026-10-15',
  weeklyRunDays: 3,
  usualSessionSeconds: 1800,
  usualEffortRpe: 4,
  currentFatigue: 3,
  confirmedAt: AS_OF,
};
export function sourceFact(id: string, revision = 1): SourceFact {
  return { userId: USER, id, revision, withdrawn: false, conflicting: false, expiresAt: null };
}
export function recordedRun(
  id: number,
  date: string,
  meters: number,
  seconds: number,
): ObjectiveRunInput {
  const startDate = `${date}T12:00:00Z`;
  return {
    userId: USER,
    id: `run-${id.toString().padStart(3, '0')}`,
    sourceId: `11111111-1111-4111-8111-${id.toString().padStart(12, '0')}`,
    sourceRevision: 1,
    startDate,
    distanceMeters: meters,
    durationSeconds: seconds,
    observation: {
      schemaVersion: 1,
      measurementSource: 'healthkit_workout',
      sourceBundleIdentifier: 'com.example.recorder',
      userEntered: null,
      activityKind: 'running',
      distanceBasis: 'workout_total',
      endDate: new Date(Date.parse(startDate) + seconds * 1000).toISOString(),
      durationBasis: 'active',
      pauses: { method: 'not_checked', intervals: null },
    },
    assertion: null,
    linkedWorkout: null,
    parentSourceId: null,
    withdrawn: false,
    segments: [],
  };
}
export function capture(
  runs: ObjectiveRunInput[],
  capturedAt = '2026-10-15T12:00:00Z',
): ObjectiveCapture {
  return {
    userId: USER,
    capturedAt,
    runs,
    coverage: {
      schemaVersion: 1,
      state: runs.length ? 'complete' : 'empty',
      requestedFrom: '2026-07-20T03:00:00Z',
      requestedTo: capturedAt,
      coveredIntervals: [{ from: '2026-07-20T03:00:00Z', to: capturedAt }],
      truncated: false,
      failureCode: null,
      assertion: {
        kind: 'all_runs_recorded',
        from: '2026-07-20T03:00:00Z',
        to: capturedAt,
        assertedAt: capturedAt,
      },
    },
  };
}
export function objectiveFixture(favorable = false) {
  const dates = [
    ['2026-09-01', '2026-09-03', '2026-09-05'],
    ['2026-09-08', '2026-09-10', '2026-09-12'],
    ['2026-09-15', '2026-09-17', '2026-09-19'],
    ['2026-09-22', '2026-09-24', '2026-09-26'],
    ['2026-09-29', '2026-10-01', '2026-10-03'],
    ['2026-10-06', '2026-10-08', '2026-10-10'],
  ];
  const runs: ObjectiveRunInput[] = [];
  for (const [tue, thu, sat] of dates) {
    runs.push(recordedRun(runs.length + 1, tue, favorable ? 12000 : 8000, favorable ? 4320 : 2880));
    if (favorable) runs.push(recordedRun(runs.length + 1, thu, 12000, 4320));
    runs.push(
      recordedRun(runs.length + 1, sat, favorable ? 18000 : 12000, favorable ? 6480 : 4320),
    );
  }
  runs.push(recordedRun(99, '2026-10-14', 10000, favorable ? 2400 : 3000));
  const uploaded = capture(runs);
  return {
    capture: uploaded,
    evidence: normalizeObjectiveEvidence({
      userId: USER,
      asOf: '2026-10-15T12:00:00Z',
      timeZone: ZONE,
      capture: uploaded,
      lastReadState: 'complete',
    }),
  };
}
export function sessionValue(seconds: number | null = 1800): SessionInput {
  return {
    timeZone: ZONE,
    activityDate: '2026-10-15',
    startedAt: null,
    endedAt: null,
    activityKind: 'running',
    durationSeconds: seconds,
    durationBasis: 'active',
    completion: 'done',
    effortRpe: 4,
    fatigue: 3,
    linkedActivityKey: null,
  };
}
export function declaration(
  sessionKey = 'session-1',
  seconds: number | null = 1800,
): SessionDeclaration {
  const head = { sessionKey, declarationRevision: 1, acceptedSequence: 1, withdrawn: false };
  return {
    userId: USER,
    sessionKey,
    revision: 1,
    value: sessionValue(seconds),
    workoutId: null,
    durationHead: head,
    feedbackHead: head,
  };
}
export function durationSource(
  seconds = 1830,
  ref = 'healthkit:activity-1',
  sessionId = 'import-1',
): DurationSource {
  return {
    userId: USER,
    activityKey: ref,
    activityDate: '2026-10-15',
    startedAt: '2026-10-15T12:00:00Z',
    endedAt: new Date(Date.parse('2026-10-15T12:00:00Z') + seconds * 1000).toISOString(),
    activityKind: 'running',
    timeZone: ZONE,
    candidate: {
      id: `${ref}:1`,
      sourceRef: ref,
      sourceRevision: 1,
      sessionId,
      basis: 'active',
      seconds,
      provenance: 'recorded',
      source: 'healthkit_workout',
      withdrawn: false,
    },
  };
}
export function anchor(q = 1800, p = 5400, f = 3): DoseAnchor {
  return {
    id: 'anchor-1',
    nominalSessionsPerWeek: f,
    sessionSeconds: q,
    nominalWeekSeconds: p,
    entryCeilingSeconds: null,
    basisIds: ['routine:routine-1:1'],
    sourceFingerprint: 'source-fingerprint',
  };
}
export function existingControl(q = 1800, p = 5400, f = 3): DoseControlState {
  return {
    ...emptyDoseControlState(),
    revision: 1,
    reference: anchor(q, p, f),
    lastDeliveryId: 'delivery-old',
    lastDeliveredStrategy: 'duration_rpe',
  };
}
export function prescriptionInput(): PrescriptionInput {
  return {
    baselineInput: {
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      experience: { level: 'experienced', source: 'explicit_context', declaredAt: AS_OF },
      routine: structuredClone(ROUTINE),
      continuity: {
        id: 'continuity-1',
        revision: 1,
        origin: 'reported',
        timeZone: ZONE,
        observedThrough: '2026-10-16',
        lastRunOn: '2026-10-15',
        confirmedAt: AS_OF,
      },
      sessions: [],
      relations: [],
      conflicts: [],
      inventory: null,
      objectivePracticeDates: [],
      preservedReference: null,
      usableSourceIds: [],
    },
    entryPreference: null,
    stateUserId: USER,
    state: emptyDoseControlState(),
    contextRevision: 1,
    contextSourceId: 'context:1',
    objective: normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: null,
      lastReadState: null,
    }),
    objectiveSourceId: null,
    target: { ...GOAL },
    calendar: {
      weekStart: '2026-10-19',
      asOf: AS_OF,
      timeZone: ZONE,
      availableDays: [1, 3, 5],
      unavailableDates: [],
      deliveredDates: [],
    },
    sourceFacts: [
      sourceFact('context:1'),
      sourceFact('routine:routine-1:1'),
      sourceFact('continuity:continuity-1:1'),
      sourceFact('week:week-2026-09-28'),
      sourceFact('week:week-2026-10-05'),
    ],
    restrictions: {
      preventsExercise: false,
      preventsAttempt: false,
      maxSessionSeconds: null,
      maxWeekSeconds: null,
      maxSessionsPerWeek: null,
      sourceIds: [],
    },
    weeks: [],
    historicalResume: null,
    newEpisodeId: 'episode-1',
    heartRateGuidanceAvailable: false,
  };
}
export function deliveredWeek(
  from = '2026-10-05',
  through = '2026-10-11',
  q = 1800,
): DeliveredWeek {
  return {
    userId: USER,
    id: `week-${from}`,
    from,
    through,
    deliveredOn: '2026-09-01',
    completeExpectedInventory: true,
    opportunities: [1, 2, 3].map((i) => ({
      id: `opportunity-${from}-${i}`,
      prescribedSeconds: 1800,
      actualSeconds: q,
      completion: 'done',
      effortRpe: 4,
      fatigue: 3,
      feedbackExplicit: true,
    })),
    conflict: false,
    restriction: false,
    controlRevisionAfter: 1,
  };
}
export function doseInput(): DosePlanInput {
  return {
    userId: USER,
    stateUserId: USER,
    state: existingControl(),
    asOf: AS_OF,
    timeZone: ZONE,
    strategy: 'duration_rpe',
    provisionalAnchor: anchor(),
    nominalFrequency: 3,
    emittedCount: 3,
    signals: [],
    weeks: [],
    sourceFacts: [
      sourceFact('context:1'),
      sourceFact('week:week-2026-09-28'),
      sourceFact('week:week-2026-10-05'),
    ],
    requiredSourceIds: ['context:1'],
    episode: null,
    limits: { maxSessionSeconds: null, maxWeekSeconds: null, maxSessionsPerWeek: null },
    smallerRoutine: null,
    progressionBlocked: false,
  };
}
