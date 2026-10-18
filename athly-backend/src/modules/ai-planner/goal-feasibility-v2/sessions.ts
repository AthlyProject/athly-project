import { compareText } from './core';
import {
  agrees,
  civil,
  finite,
  instant,
  integer,
  localDate,
  oneOf,
  owned,
  requireInput,
  stableHash,
  timeZone,
  uniqueSorted,
} from './core';
import type { Instant, LocalDate } from './core';
import type {
  ActivityKind,
  CanonicalDuration,
  DeclarationHead,
  DoseObservation,
  DoseSource,
  DurationCandidate,
  Rpe,
  SessionInput,
  TimerCaptureInput,
} from './types';
import { unionOffsets } from './objective';

export function validateRpe(value: Rpe | null): void {
  if (value !== null) integer(value, 1, 10);
}
export function validateSessionInput(value: SessionInput, asOf: Instant): void {
  timeZone(value.timeZone);
  oneOf(value.activityKind, ['running', 'run_walk', 'walking', 'unknown']);
  oneOf(value.durationBasis, ['active', 'elapsed', 'unknown']);
  oneOf(value.completion, ['done', 'partial', 'not_started', 'unknown']);
  validateRpe(value.effortRpe);
  validateRpe(value.fatigue);
  const today = localDate(asOf, value.timeZone);
  if (value.activityDate !== null) {
    civil(value.activityDate);
    requireInput(value.activityDate <= today);
  }
  if (value.startedAt !== null) {
    requireInput(instant(value.startedAt) <= instant(asOf));
    if (value.activityDate !== null)
      requireInput(localDate(value.startedAt, value.timeZone) === value.activityDate);
  }
  if (value.endedAt !== null) {
    requireInput(
      value.startedAt !== null &&
        instant(value.endedAt) > instant(value.startedAt) &&
        instant(value.endedAt) <= instant(asOf),
    );
  }
  if (value.durationSeconds !== null) {
    integer(value.durationSeconds, 0, 86400);
    requireInput(value.durationSeconds > 0 || value.completion === 'not_started');
    if (value.durationBasis === 'active' && value.startedAt && value.endedAt)
      requireInput(
        value.durationSeconds <= (instant(value.endedAt) - instant(value.startedAt)) / 1000 + 1,
      );
  }
  if (value.completion === 'not_started')
    requireInput(value.durationSeconds === null || value.durationSeconds === 0);
}

export function validateTimerCapture(value: TimerCaptureInput, asOf: Instant): void {
  timeZone(value.timeZone);
  oneOf(value.activityKind, ['running', 'run_walk', 'walking']);
  const elapsed = (instant(value.endedAt) - instant(value.startedAt)) / 1000;
  requireInput(elapsed > 0 && instant(value.endedAt) <= instant(asOf));
  finite(value.activeSeconds);
  requireInput(value.activeSeconds > 0);
  const pauses = unionOffsets(
    value.pauses.map((p) => ({
      startOffsetSeconds: (instant(p.startedAt) - instant(value.startedAt)) / 1000,
      endOffsetSeconds: (instant(p.endedAt) - instant(value.startedAt)) / 1000,
    })),
    elapsed,
  );
  const expected =
    elapsed - pauses.reduce((sum, p) => sum + p.endOffsetSeconds - p.startOffsetSeconds, 0);
  requireInput(Math.abs(value.activeSeconds - expected) <= 1);
}

/** Server-owned snapshot. Sequences and identities must be assigned by the future adapter. */
export type SessionDeclaration = {
  userId: string;
  sessionKey: string;
  revision: number;
  value: SessionInput | null;
  workoutId: string | null;
  durationHead: DeclarationHead | null;
  feedbackHead: DeclarationHead | null;
  /** Identity survives a tombstone; it is not a fallback execution declaration. */
  withdrawnActivityKey?: string | null;
};
export function reviseDeclaration(input: {
  current: SessionDeclaration;
  expectedRevision: number;
  value: SessionInput | null;
  acceptedSequence: number;
  asOf: Instant;
}): SessionDeclaration {
  const { current, value } = input;
  requireInput(current.revision === input.expectedRevision, 'SESSION_REPORT_CHANGED');
  integer(input.acceptedSequence, 1);
  if (value) validateSessionInput(value, input.asOf);
  if (stableHash(value) === stableHash(current.value)) return structuredClone(current);
  const facts = (v: SessionInput | null) =>
    v === null
      ? null
      : {
          timeZone: v.timeZone,
          activityDate: v.activityDate,
          startedAt: v.startedAt,
          endedAt: v.endedAt,
          activityKind: v.activityKind,
          durationSeconds: v.durationSeconds,
          durationBasis: v.durationBasis,
          completion: v.completion,
          linkedActivityKey: v.linkedActivityKey,
        };
  const newHead: DeclarationHead = {
    sessionKey: current.sessionKey,
    declarationRevision: current.revision + 1,
    acceptedSequence: input.acceptedSequence,
    withdrawn: value === null,
  };
  const durationChanged = stableHash(facts(value)) !== stableHash(facts(current.value));
  const feedbackChanged =
    value === null ||
    current.value === null ||
    value.effortRpe !== current.value.effortRpe ||
    value.fatigue !== current.value.fatigue;
  for (const head of [current.durationHead, current.feedbackHead])
    if (head) requireInput(input.acceptedSequence > head.acceptedSequence);
  return {
    ...structuredClone(current),
    revision: current.revision + 1,
    value: structuredClone(value),
    withdrawnActivityKey:
      value === null
        ? (current.value?.linkedActivityKey ?? current.withdrawnActivityKey ?? null)
        : null,
    durationHead: durationChanged ? newHead : structuredClone(current.durationHead),
    feedbackHead: feedbackChanged ? newHead : structuredClone(current.feedbackHead),
  };
}

export type DurationSource = {
  userId: string;
  candidate: DurationCandidate;
  activityKey: string;
  activityDate: LocalDate | null;
  startedAt: Instant | null;
  endedAt: Instant | null;
  activityKind: ActivityKind;
  timeZone: string;
};
export function timerDurationSource(input: {
  userId: string;
  sessionKey: string;
  revision: number;
  capture: TimerCaptureInput | null;
  asOf: Instant;
}): DurationSource {
  const value = input.capture;
  if (value) validateTimerCapture(value, input.asOf);
  return {
    userId: input.userId,
    candidate: {
      id: `timer:${input.sessionKey}:${input.revision}`,
      sourceRef: `timer:${input.sessionKey}`,
      sourceRevision: input.revision,
      sessionId: input.sessionKey,
      source: 'athly_timer',
      provenance: 'recorded',
      basis: 'active',
      seconds: value?.activeSeconds ?? null,
      withdrawn: value === null,
    },
    activityKey: `timer:${input.sessionKey}`,
    activityDate: value ? localDate(value.startedAt, value.timeZone) : null,
    startedAt: value?.startedAt ?? null,
    endedAt: value?.endedAt ?? null,
    activityKind: value?.activityKind ?? 'unknown',
    timeZone: value?.timeZone ?? 'UTC',
  };
}
export type SessionRelation = {
  userId: string;
  id: string;
  revision: number;
  members: [string, string];
  action: 'same_session' | 'distinct_sessions' | 'clear';
};
function canonicalRelation(relation: SessionRelation): SessionRelation {
  const [a, b] = relation.members;
  requireInput(a.length > 0 && b.length > 0 && a !== b);
  return { ...relation, members: a < b ? [a, b] : [b, a] };
}
/** Carry withdrawal/suppression barriers when a previously merged group is divided. */
export type HeadBarrier = {
  userId: string;
  memberIds: string[];
  durationHead: DeclarationHead | null;
  feedbackHead: DeclarationHead | null;
};
export type DurationResolution = {
  userId: string;
  id: string;
  sessionId: string;
  inputsHash: string;
  candidateId: string;
  withdrawn: boolean;
};
export type SessionConflict = {
  id: string;
  kind: 'duration' | 'overlap' | 'history';
  inputsHash: string;
  memberIds: string[];
  durationCandidates: DurationCandidate[];
};
export type CanonicalSession = {
  userId: string;
  startedAt: Instant | null;
  dateAmbiguous: boolean;
  id: string;
  memberIds: string[];
  durationHead: DeclarationHead | null;
  feedbackHead: DeclarationHead | null;
  durationCandidates: DurationCandidate[];
  observation: DoseObservation;
  inputsHash: string;
};

function latest<T>(items: readonly T[], key: (v: T) => string, revision: (v: T) => number): T[] {
  const result = new Map<string, T>();
  for (const item of items) {
    integer(revision(item));
    const old = result.get(key(item));
    if (!old || revision(item) > revision(old)) result.set(key(item), item);
    else if (revision(item) === revision(old))
      requireInput(stableHash(item) === stableHash(old), 'SOURCE_REVISION_CONFLICT');
  }
  return [...result.values()].sort((a, b) => compareText(key(a), key(b)));
}

export function durationInputsHash(
  candidates: readonly DurationCandidate[],
  identityFacts: unknown,
): string {
  return stableHash({
    candidates: [...candidates].sort((a, b) => compareText(a.id, b.id)),
    identityFacts,
  });
}
export function canonicalDuration(
  candidates: readonly DurationCandidate[],
  inputsHash: string,
  resolution: Pick<DurationResolution, 'id' | 'inputsHash' | 'candidateId' | 'withdrawn'> | null,
): CanonicalDuration {
  requireInput(
    new Set(candidates.map((c) => c.id)).size === candidates.length,
    'DURATION_CANDIDATE_ID_CONFLICT',
  );
  for (const candidate of candidates) {
    integer(candidate.sourceRevision);
    oneOf(candidate.basis, ['active', 'elapsed', 'unknown']);
    oneOf(candidate.provenance, ['recorded', 'reported', 'unknown']);
    oneOf(candidate.source, [
      'athly_timer',
      'healthkit_workout',
      'confirmed_import',
      'user_report',
      'legacy_unknown',
    ]);
    requireInput(candidate.seconds === null || finite(candidate.seconds) >= 0);
    requireInput(candidate.source !== 'legacy_unknown' || candidate.provenance === 'unknown');
  }
  const current = candidates.filter(
    (c) =>
      !c.withdrawn &&
      c.seconds !== null &&
      c.seconds > 0 &&
      c.basis !== 'unknown' &&
      c.provenance !== 'unknown',
  );
  const conflicting = (['active', 'elapsed'] as const).some((basis) => {
    const values = current.filter((c) => c.basis === basis).map((c) => c.seconds!);
    return values.length > 1 && !agrees(Math.min(...values), Math.max(...values));
  });
  const explicit =
    resolution && !resolution.withdrawn && resolution.inputsHash === inputsHash
      ? current.find((c) => c.id === resolution.candidateId && c.basis === 'active')
      : null;
  const priority: Record<DoseSource, number> = {
    athly_timer: 0,
    healthkit_workout: 1,
    confirmed_import: 2,
    user_report: 3,
    legacy_unknown: 4,
  };
  const chosen =
    explicit ??
    (!conflicting
      ? current
          .filter((c) => c.basis === 'active')
          .sort(
            (a, b) =>
              Number(b.provenance === 'recorded') - Number(a.provenance === 'recorded') ||
              priority[a.source] - priority[b.source] ||
              compareText(a.id, b.id),
          )[0]
      : null);
  return {
    activeSeconds: chosen?.seconds ?? null,
    candidateId: chosen?.id ?? null,
    provenance: chosen?.provenance ?? 'unknown',
    state: chosen ? 'usable' : conflicting ? 'conflicting' : 'missing',
    inputsHash,
    resolutionId: explicit ? resolution!.id : null,
  };
}

function maxHead(heads: (DeclarationHead | null)[]): DeclarationHead | null {
  const sorted = [...heads]
    .filter((h): h is DeclarationHead => h !== null)
    .sort(
      (a, b) =>
        b.acceptedSequence - a.acceptedSequence ||
        b.declarationRevision - a.declarationRevision ||
        compareText(a.sessionKey, b.sessionKey),
    );
  const head = sorted[0] ?? null;
  if (head)
    requireInput(
      sorted
        .filter((h) => h.acceptedSequence === head.acceptedSequence)
        .every((h) => stableHash(h) === stableHash(head)),
      'DECLARATION_SEQUENCE_CONFLICT',
    );
  return head;
}
function validateHead(head: DeclarationHead | null): void {
  if (!head) return;
  integer(head.acceptedSequence, 1);
  integer(head.declarationRevision, 1);
  requireInput(head.sessionKey.length > 0 && typeof head.withdrawn === 'boolean');
}

/** No account filtering: mixed-account input is rejected before inspecting identity or resolution. */
export function normalizeDurationSessions(input: {
  userId: string;
  asOf: Instant;
  timeZone: string;
  declarations: SessionDeclaration[];
  sources: DurationSource[];
  relations: SessionRelation[];
  resolutions: DurationResolution[];
  barriers: HeadBarrier[];
  legacyFeedback?: Array<{
    userId: string;
    id: string;
    sessionId: string;
    createdAt: Instant;
    effortRpe: Rpe | null;
    fatigue: Rpe | null;
  }>;
}): { sessions: CanonicalSession[]; conflicts: SessionConflict[]; sessionSetHash: string } {
  owned(input.userId, [
    ...input.declarations,
    ...input.sources,
    ...input.relations,
    ...input.resolutions,
    ...input.barriers,
    ...(input.legacyFeedback ?? []),
  ]);
  instant(input.asOf);
  timeZone(input.timeZone);
  input.barriers.forEach((b) => {
    validateHead(b.durationHead);
    validateHead(b.feedbackHead);
  });
  const declarations = latest(
    input.declarations,
    (d) => d.sessionKey,
    (d) => d.revision,
  );
  for (const d of declarations) {
    if (d.value) validateSessionInput(d.value, input.asOf);
    validateHead(d.durationHead);
    validateHead(d.feedbackHead);
    for (const head of [d.durationHead, d.feedbackHead])
      if (head && head.sessionKey === d.sessionKey)
        requireInput(head.declarationRevision <= d.revision);
  }
  for (const feedback of input.legacyFeedback ?? []) {
    requireInput(instant(feedback.createdAt) <= instant(input.asOf));
    validateRpe(feedback.effortRpe);
    validateRpe(feedback.fatigue);
  }
  const sources = latest(
    input.sources,
    (s) => s.candidate.sourceRef,
    (s) => s.candidate.sourceRevision,
  );
  for (const s of sources) {
    timeZone(s.timeZone);
    const c = s.candidate;
    oneOf(c.basis, ['active', 'elapsed', 'unknown']);
    oneOf(c.provenance, ['recorded', 'reported', 'unknown']);
    oneOf(c.source, [
      'healthkit_workout',
      'athly_timer',
      'confirmed_import',
      'user_report',
      'legacy_unknown',
    ]);
    if (c.seconds !== null) requireInput(finite(c.seconds) >= 0);
    if (s.activityDate) {
      civil(s.activityDate);
      requireInput(s.activityDate <= localDate(input.asOf, s.timeZone));
    }
    if (s.startedAt) requireInput(instant(s.startedAt) <= instant(input.asOf));
    if (s.endedAt) {
      requireInput(
        s.startedAt &&
          instant(s.endedAt) > instant(s.startedAt) &&
          instant(s.endedAt) <= instant(input.asOf),
      );
      if (c.basis === 'active' && c.seconds !== null)
        requireInput(c.seconds <= (instant(s.endedAt) - instant(s.startedAt)) / 1000 + 1);
    }
  }
  const relations = latest(
    input.relations.map(canonicalRelation),
    (r) => r.id,
    (r) => r.revision,
  ).filter((r) => r.action !== 'clear');
  const ids = uniqueSorted([
    ...declarations.map((d) => d.sessionKey),
    ...sources.map((s) => s.candidate.sessionId),
  ]);
  const parent = new Map(ids.map((id) => [id, id]));
  const root = (id: string): string => {
    requireInput(parent.has(id), 'SESSION_NOT_FOUND');
    let r = id;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const join = (a: string, b: string) => {
    const ra = root(a);
    const rb = root(b);
    parent.set(ra > rb ? ra : rb, ra > rb ? rb : ra);
  };
  // Source identities and explicit links are immutable; plannedWorkoutId is deliberately absent.
  for (const a of sources)
    for (const b of sources)
      if (a.activityKey === b.activityKey) join(a.candidate.sessionId, b.candidate.sessionId);
  for (const d of declarations) {
    if (d.value?.linkedActivityKey || d.withdrawnActivityKey)
      for (const s of sources)
        if (s.activityKey === (d.value?.linkedActivityKey ?? d.withdrawnActivityKey))
          join(d.sessionKey, s.candidate.sessionId);
  }
  for (const r of relations) {
    oneOf(r.action, ['same_session', 'distinct_sessions', 'clear']);
    if (r.action === 'same_session') join(...r.members);
  }
  for (const r of relations)
    if (r.action === 'distinct_sessions')
      requireInput(root(r.members[0]) !== root(r.members[1]), 'SESSION_RELATION_CONFLICT');
  const grouped = new Map<string, string[]>();
  for (const id of ids) {
    const key = root(id);
    grouped.set(key, [...(grouped.get(key) ?? []), id]);
  }
  const sessions: CanonicalSession[] = [];
  const conflicts: SessionConflict[] = [];
  for (const [id, memberIds] of grouped) {
    const members = declarations.filter((d) => memberIds.includes(d.sessionKey));
    const recorded = sources.filter((s) => memberIds.includes(s.candidate.sessionId));
    const barriers = input.barriers.filter((b) => b.memberIds.some((m) => memberIds.includes(m)));
    const durationHead = maxHead([
      ...members.map((d) => d.durationHead),
      ...barriers.map((b) => b.durationHead),
    ]);
    const feedbackHead = maxHead([
      ...members.map((d) => d.feedbackHead),
      ...barriers.map((b) => b.feedbackHead),
    ]);
    const durationDeclaration =
      durationHead && !durationHead.withdrawn
        ? members.find((d) => d.sessionKey === durationHead.sessionKey && d.value)
        : null;
    const feedbackDeclaration =
      feedbackHead && !feedbackHead.withdrawn
        ? members.find((d) => d.sessionKey === feedbackHead.sessionKey && d.value)
        : null;
    const candidates: DurationCandidate[] = recorded.map((s) => structuredClone(s.candidate));
    if (durationDeclaration?.value && durationHead)
      candidates.push({
        id: `reported:${durationDeclaration.sessionKey}:${durationHead.declarationRevision}`,
        sourceRef: `reported:${durationDeclaration.sessionKey}`,
        sourceRevision: durationHead.declarationRevision,
        sessionId: id,
        basis: durationDeclaration.value.durationBasis,
        seconds: durationDeclaration.value.durationSeconds,
        provenance: 'reported',
        source: 'user_report',
        withdrawn: false,
      });
    const v = durationDeclaration?.value;
    const identityFacts = {
      memberIds,
      relations: relations.filter((r) => r.members.some((m) => memberIds.includes(m))),
      sources: recorded.map((s) => ({
        activityKey: s.activityKey,
        sessionId: s.candidate.sessionId,
        activityDate: s.activityDate,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        activityKind: s.activityKind,
        timeZone: s.timeZone,
      })),
      declaration: v
        ? {
            activityDate: v.activityDate,
            startedAt: v.startedAt,
            endedAt: v.endedAt,
            activityKind: v.activityKind,
            timeZone: v.timeZone,
            linkedActivityKey: v.linkedActivityKey,
          }
        : null,
      durationHead,
    };
    const inputsHash = durationInputsHash(candidates, identityFacts);
    const applicableResolutions = input.resolutions.filter(
      (r) => r.sessionId === id && r.inputsHash === inputsHash && !r.withdrawn,
    );
    requireInput(applicableResolutions.length <= 1, 'CONFLICT_CHANGED');
    const duration = canonicalDuration(candidates, inputsHash, applicableResolutions[0] ?? null);
    if (
      v?.completion === 'not_started' &&
      duration.activeSeconds !== null &&
      duration.activeSeconds > 0
    )
      conflicts.push({
        id: stableHash({ userId: input.userId, id, kind: 'history' }),
        kind: 'history',
        inputsHash,
        memberIds,
        durationCandidates: [],
      });
    if (duration.state === 'conflicting')
      conflicts.push({
        id: stableHash({ userId: input.userId, id, kind: 'duration' }),
        kind: 'duration',
        inputsHash,
        memberIds,
        durationCandidates: candidates,
      });
    const selectedSource = recorded.find((s) => s.candidate.id === duration.candidateId);
    const selectedCandidate = candidates.find((c) => c.id === duration.candidateId);
    const feedback = feedbackDeclaration?.value;
    const startedAt = selectedSource?.startedAt ?? v?.startedAt ?? null;
    const sourceZone = selectedSource?.timeZone ?? v?.timeZone;
    const dateAmbiguous =
      startedAt === null && sourceZone !== undefined && sourceZone !== input.timeZone;
    const activityDate =
      startedAt !== null
        ? localDate(startedAt, input.timeZone)
        : dateAmbiguous
          ? null
          : (selectedSource?.activityDate ?? v?.activityDate ?? null);
    const activityKind = selectedSource?.activityKind ?? v?.activityKind ?? 'unknown';
    const legacyFeedback =
      feedbackHead === null
        ? (input.legacyFeedback ?? [])
            .filter((f) => memberIds.includes(f.sessionId))
            .sort(
              (a, b) => instant(b.createdAt) - instant(a.createdAt) || compareText(b.id, a.id),
            )[0]
        : null;
    const observation: DoseObservation = {
      duration,
      activeSeconds: duration.activeSeconds,
      canonicalSessionId: id,
      sessionKey: durationDeclaration?.sessionKey ?? id,
      workoutId: members.find((d) => d.workoutId !== null)?.workoutId ?? null,
      source: selectedCandidate?.source ?? 'legacy_unknown',
      provenance: duration.provenance,
      activityDate,
      activityKind,
      completion: v?.completion ?? 'unknown',
      effortRpe: feedback ? feedback.effortRpe : (legacyFeedback?.effortRpe ?? null),
      fatigue: feedback ? feedback.fatigue : (legacyFeedback?.fatigue ?? null),
      feedbackExplicit: !!feedback,
      feedbackReferenceId:
        feedbackDeclaration && feedbackHead
          ? `reported:${feedbackDeclaration.sessionKey}:${feedbackHead.declarationRevision}`
          : null,
      referenceIds: uniqueSorted(
        [
          selectedCandidate?.sourceRef,
          feedbackDeclaration && feedbackHead
            ? `reported:${feedbackDeclaration.sessionKey}:${feedbackHead.declarationRevision}`
            : null,
          duration.resolutionId,
        ].filter((r): r is string => !!r),
      ),
    };
    sessions.push({
      userId: input.userId,
      startedAt,
      dateAmbiguous,
      id,
      memberIds,
      durationHead: structuredClone(durationHead),
      feedbackHead: structuredClone(feedbackHead),
      durationCandidates: candidates,
      observation,
      inputsHash,
    });
  }
  // A date-only report and an independent import on that date are pending, never summed by assumption.
  for (let i = 0; i < sessions.length; i++)
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      const distinct = relations.some(
        (r) =>
          r.action === 'distinct_sessions' &&
          ((a.memberIds.includes(r.members[0]) && b.memberIds.includes(r.members[1])) ||
            (a.memberIds.includes(r.members[1]) && b.memberIds.includes(r.members[0]))),
      );
      const dateOnlyA = declarations.some(
        (d) => a.memberIds.includes(d.sessionKey) && d.value?.activityDate && !d.value.startedAt,
      );
      const dateOnlyB = declarations.some(
        (d) => b.memberIds.includes(d.sessionKey) && d.value?.activityDate && !d.value.startedAt,
      );
      if (
        !distinct &&
        (dateOnlyA || dateOnlyB) &&
        a.observation.activityDate !== null &&
        a.observation.activityDate === b.observation.activityDate
      ) {
        const memberIds = uniqueSorted([...a.memberIds, ...b.memberIds]);
        conflicts.push({
          id: stableHash({ userId: input.userId, memberIds, kind: 'overlap' }),
          kind: 'overlap',
          inputsHash: stableHash([a.inputsHash, b.inputsHash]),
          memberIds,
          durationCandidates: [],
        });
      }
    }
  const sorted = sessions.sort((a, b) => compareText(a.id, b.id));
  return {
    sessions: sorted,
    conflicts: conflicts.sort((a, b) => compareText(a.id, b.id)),
    sessionSetHash: stableHash({
      userId: input.userId,
      timeZone: input.timeZone,
      sessions: sorted,
      relations,
      barriers: input.barriers
        .map((b) => ({ ...b, memberIds: uniqueSorted(b.memberIds) }))
        .sort((a, b) => compareText(stableHash(a), stableHash(b))),
    }),
  };
}

/** Inventory hashes are scoped to their actual interval, including external identity relations. */
export function sessionWindowHash(input: {
  userId: string;
  timeZone: string;
  periodFrom: LocalDate;
  periodThrough: LocalDate;
  sessions: CanonicalSession[];
  relations: SessionRelation[];
}): string {
  timeZone(input.timeZone);
  civil(input.periodFrom);
  civil(input.periodThrough);
  requireInput(input.periodFrom <= input.periodThrough);
  owned(input.userId, [...input.relations, ...input.sessions]);
  const sessions = input.sessions
    .filter(
      (s) =>
        s.observation.activityDate !== null &&
        s.observation.activityDate >= input.periodFrom &&
        s.observation.activityDate <= input.periodThrough,
    )
    .sort((a, b) => compareText(a.id, b.id));
  const members = new Set(sessions.flatMap((s) => s.memberIds));
  return stableHash({
    userId: input.userId,
    timeZone: input.timeZone,
    periodFrom: input.periodFrom,
    periodThrough: input.periodThrough,
    sessions,
    relations: input.relations
      .map(canonicalRelation)
      .filter((r) => r.members.some((m) => members.has(m)))
      .sort((a, b) => compareText(a.id, b.id)),
  });
}
