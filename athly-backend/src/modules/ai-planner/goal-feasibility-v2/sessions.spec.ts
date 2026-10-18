import {
  canonicalDuration,
  normalizeDurationSessions,
  reviseDeclaration,
  sessionWindowHash,
  timerDurationSource,
  validateSessionInput,
  validateTimerCapture,
} from './sessions';
import type { DurationResolution, SessionDeclaration, SessionRelation } from './sessions';
import { AS_OF, declaration, durationSource, sessionValue, USER, ZONE } from './test-fixtures';

function normalize(
  declarations = [declaration()],
  sources = [durationSource()],
  relations: SessionRelation[] = [],
  resolutions: DurationResolution[] = [],
) {
  return normalizeDurationSessions({
    userId: USER,
    asOf: AS_OF,
    timeZone: ZONE,
    declarations,
    sources,
    relations,
    resolutions,
    barriers: [],
  });
}
function linked(seconds = 1800) {
  const report = declaration('session-1', seconds);
  report.value!.linkedActivityKey = 'healthkit:activity-1';
  return report;
}

describe('canonical active duration and independent declaration heads', () => {
  it.each([
    [1800, 1830, 'usable', 1830],
    [1960, 2000, 'usable', 2000],
    [1959, 2000, 'conflicting', null],
  ] as const)(
    'normalizes report %s and measured %s with max(a,b) denominator',
    (reported, measured, state, seconds) => {
      const result = normalize([linked(reported)], [durationSource(measured)]);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].observation).toMatchObject({
        activeSeconds: seconds,
        effortRpe: 4,
        fatigue: 3,
        duration: { state, provenance: state === 'usable' ? 'recorded' : 'unknown' },
      });
      expect(result.conflicts).toHaveLength(state === 'usable' ? 0 : 1);
    },
  );

  it('requires agreement of every pair, including 1960/2000/2040 extremes', () => {
    const sources = [
      durationSource(1960, 'timer:a', 'same'),
      durationSource(2000, 'healthkit:b', 'same'),
      durationSource(2040, 'import:c', 'same'),
    ];
    expect(normalize([], sources).sessions[0].observation.duration.state).toBe('conflicting');
  });

  it('compares active and elapsed partitions separately and never converts elapsed/unknown', () => {
    const source = durationSource(4000);
    source.candidate.basis = 'elapsed';
    const first = normalize([linked()], [source]);
    expect(first.sessions[0].observation).toMatchObject({
      activeSeconds: 1800,
      provenance: 'reported',
    });
    const report = linked();
    report.value!.durationBasis = 'elapsed';
    expect(normalize([report], [source]).sessions[0].observation.duration.state).toBe(
      'conflicting',
    );
    report.value!.durationSeconds = 4000;
    const elapsed = normalize([report], [source]);
    expect(elapsed.sessions[0].observation).toMatchObject({
      activeSeconds: null,
      duration: { state: 'missing' },
    });
    source.candidate.basis = 'unknown';
    report.value!.durationBasis = 'unknown';
    expect(normalize([report], [source]).sessions[0].observation.activeSeconds).toBeNull();
  });

  it('prefers timer, then known-base HealthKit, then confirmed import, then the current report', () => {
    const timer = durationSource(1810, 'timer:a', 'same');
    timer.candidate.source = 'athly_timer';
    const hk = durationSource(1830, 'healthkit:b', 'same');
    const imported = durationSource(1820, 'import:c', 'same');
    imported.candidate.source = 'confirmed_import';
    expect(normalize([], [hk, imported, timer]).sessions[0].observation.activeSeconds).toBe(1810);
    expect(normalize([], [imported, hk]).sessions[0].observation.activeSeconds).toBe(1830);
  });

  it('keeps only the latest source revision and never resurrects a withdrawn source', () => {
    const old = durationSource(1800);
    const revised = structuredClone(old);
    revised.candidate = { ...old.candidate, id: 'revised', sourceRevision: 2, seconds: 900 };
    const tombstone = structuredClone(revised);
    tombstone.candidate = {
      ...revised.candidate,
      id: 'tombstone',
      sourceRevision: 3,
      withdrawn: true,
      seconds: null,
    };
    expect(normalize([], [old, revised]).sessions[0].observation.activeSeconds).toBe(900);
    expect(
      normalize([], [tombstone, old, revised]).sessions[0].observation.activeSeconds,
    ).toBeNull();
    const conflict = structuredClone(old);
    conflict.candidate.seconds = 1799;
    expect(() => normalize([], [old, conflict])).toThrow('SOURCE_REVISION_CONFLICT');
  });

  it('selects the current duration head before comparison with recorded sources', () => {
    const old = declaration('old', 900);
    const current = declaration('current', 1800);
    current.durationHead!.acceptedSequence = 2;
    current.feedbackHead!.acceptedSequence = 2;
    old.value!.linkedActivityKey = current.value!.linkedActivityKey = 'healthkit:activity-1';
    const result = normalize([old, current]);
    expect(result.sessions[0].durationCandidates.map((c) => c.seconds)).toEqual([1830, 1800]);
    expect(result.sessions[0].observation.activeSeconds).toBe(1830);
  });

  it('rating-only revision preserves duration candidate and a valid explicit duration resolution', () => {
    const report = linked(900);
    const initial = normalize([report]);
    const group = initial.sessions[0];
    const resolution: DurationResolution = {
      userId: USER,
      id: 'resolution-1',
      sessionId: group.id,
      inputsHash: group.inputsHash,
      candidateId: 'reported:session-1:1',
      withdrawn: false,
    };
    expect(normalize([report], undefined, [], [resolution]).sessions[0].observation).toMatchObject({
      activeSeconds: 900,
      provenance: 'reported',
    });
    const rated = reviseDeclaration({
      current: report,
      expectedRevision: 1,
      value: { ...report.value!, effortRpe: 8, fatigue: null },
      acceptedSequence: 2,
      asOf: AS_OF,
    });
    const after = normalize([rated], undefined, [], [resolution]);
    expect(after.sessions[0].inputsHash).toBe(group.inputsHash);
    expect(after.sessions[0].observation).toMatchObject({
      activeSeconds: 900,
      effortRpe: 8,
      fatigue: null,
      duration: { resolutionId: 'resolution-1' },
    });
    expect(rated.durationHead!.declarationRevision).toBe(1);
    expect(rated.feedbackHead!.declarationRevision).toBe(2);
    const changed = reviseDeclaration({
      current: rated,
      expectedRevision: 2,
      value: { ...rated.value!, durationSeconds: 1000 },
      acceptedSequence: 3,
      asOf: AS_OF,
    });
    const changedResult = normalize([changed], undefined, [], [resolution]);
    expect(changedResult.sessions[0].inputsHash).not.toBe(group.inputsHash);
    expect(changedResult.sessions[0].observation.duration).toMatchObject({
      state: 'conflicting',
      resolutionId: null,
    });
  });

  it('invalidates a selected source when withdrawn, without restoring a suppressed report', () => {
    const old = declaration('old', 1800);
    old.value!.linkedActivityKey = 'healthkit:activity-1';
    const newer = linked(900);
    newer.durationHead!.acceptedSequence = 2;
    newer.feedbackHead!.acceptedSequence = 2;
    const withdrawn = reviseDeclaration({
      current: newer,
      expectedRevision: 1,
      value: null,
      acceptedSequence: 3,
      asOf: AS_OF,
    });
    // Identity is retained through the explicit relation after the declaration is withdrawn.
    const relation: SessionRelation = {
      userId: USER,
      id: 'same',
      revision: 1,
      members: ['old', 'session-1'],
      action: 'same_session',
    };
    const result = normalize([old, withdrawn], undefined, [relation]);
    expect(result.sessions[0].durationCandidates.map((c) => c.source)).toEqual([
      'healthkit_workout',
    ]);
    expect(result.sessions[0].observation).toMatchObject({
      activeSeconds: 1830,
      effortRpe: null,
      fatigue: null,
      feedbackExplicit: false,
    });
    const source = durationSource();
    source.candidate.withdrawn = true;
    expect(
      normalize([old, withdrawn], [source], [relation]).sessions[0].observation.activeSeconds,
    ).toBeNull();
  });

  it('does not let a rating-only edit revive the old declaration duration in a merged group', () => {
    const old = linked(900);
    const newer = declaration('newer', 1800);
    newer.value!.linkedActivityKey = 'healthkit:activity-1';
    newer.durationHead!.acceptedSequence = newer.feedbackHead!.acceptedSequence = 2;
    const ratedOld = reviseDeclaration({
      current: old,
      expectedRevision: 1,
      value: { ...old.value!, effortRpe: 7 },
      acceptedSequence: 3,
      asOf: AS_OF,
    });
    const result = normalize([ratedOld, newer]);
    expect(result.sessions[0]).toMatchObject({
      durationHead: { sessionKey: 'newer' },
      feedbackHead: { sessionKey: 'session-1' },
    });
    expect(result.sessions[0].observation).toMatchObject({ activeSeconds: 1830, effortRpe: 7 });
  });

  it('carries suppression barriers when a merged group is divided', () => {
    const old = declaration('old', 900);
    const newer = declaration('newer', 1800);
    newer.durationHead!.acceptedSequence = newer.feedbackHead!.acceptedSequence = 2;
    const output = normalizeDurationSessions({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      declarations: [old, newer],
      sources: [],
      relations: [],
      resolutions: [],
      barriers: [
        {
          userId: USER,
          memberIds: ['old', 'newer'],
          durationHead: newer.durationHead,
          feedbackHead: newer.feedbackHead,
        },
      ],
    });
    expect(output.sessions.find((s) => s.id === 'old')!.observation.activeSeconds).toBeNull();
    expect(output.sessions.find((s) => s.id === 'newer')!.observation.activeSeconds).toBe(1800);
  });

  it('does not sum a date-only report with an import until identity or distinctness is resolved', () => {
    const unresolved = normalize();
    expect(unresolved.sessions).toHaveLength(2);
    expect(unresolved.conflicts.map((c) => c.kind)).toEqual(['overlap']);
    const distinct: SessionRelation = {
      userId: USER,
      id: 'distinct',
      revision: 1,
      members: ['session-1', 'import-1'],
      action: 'distinct_sessions',
    };
    expect(normalize(undefined, undefined, [distinct]).conflicts).toEqual([]);
    const same = { ...distinct, action: 'same_session' as const };
    expect(normalize(undefined, undefined, [same]).sessions).toHaveLength(1);
    expect(() =>
      normalize(undefined, undefined, [same, { ...distinct, id: 'contradiction' }]),
    ).toThrow('SESSION_RELATION_CONFLICT');
  });

  it('cannot declare an immutable activity identity distinct from itself', () => {
    const first = durationSource();
    const second = durationSource(1830, 'healthkit:activity-1', 'import-2');
    second.candidate.sourceRef = 'mirror';
    second.candidate.id = 'mirror:1';
    const distinct: SessionRelation = {
      userId: USER,
      id: 'bad-distinct',
      revision: 1,
      members: ['import-1', 'import-2'],
      action: 'distinct_sessions',
    };
    expect(() => normalize([], [first, second], [distinct])).toThrow('SESSION_RELATION_CONFLICT');
  });

  it('validates active timer capture against union of pauses, independently of a report', () => {
    const timer = {
      timeZone: ZONE,
      startedAt: '2026-10-15T12:00:00Z',
      endedAt: '2026-10-15T12:40:00Z',
      activityKind: 'running' as const,
      activeSeconds: 1800,
      pauses: [
        { startedAt: '2026-10-15T12:10:00Z', endedAt: '2026-10-15T12:20:00Z' },
        { startedAt: '2026-10-15T12:15:00Z', endedAt: '2026-10-15T12:20:00Z' },
      ],
    };
    expect(() => validateTimerCapture(timer, AS_OF)).not.toThrow();
    expect(() => validateTimerCapture({ ...timer, activeSeconds: 1802 }, AS_OF)).toThrow(
      'INVALID_REQUEST',
    );
    const source = timerDurationSource({
      userId: USER,
      sessionKey: 'session-1',
      revision: 1,
      capture: timer,
      asOf: AS_OF,
    });
    const report = declaration();
    const withdrawn = reviseDeclaration({
      current: report,
      expectedRevision: 1,
      value: null,
      acceptedSequence: 2,
      asOf: AS_OF,
    });
    expect(normalize([withdrawn], [source]).sessions[0].observation).toMatchObject({
      activeSeconds: 1800,
      source: 'athly_timer',
    });
    const tombstone = timerDurationSource({
      userId: USER,
      sessionKey: 'session-1',
      revision: 2,
      capture: null,
      asOf: AS_OF,
    });
    expect(
      normalize([withdrawn], [source, tombstone]).sessions[0].observation.activeSeconds,
    ).toBeNull();
  });

  it('does not fill nulls from old revisions; enforces pure CAS and no-op sequence stability', () => {
    const current = declaration();
    const unknown = { ...sessionValue(null), effortRpe: null, fatigue: null };
    const revised = reviseDeclaration({
      current,
      expectedRevision: 1,
      value: unknown,
      acceptedSequence: 2,
      asOf: AS_OF,
    });
    expect(normalize([current, revised], []).sessions[0].observation).toMatchObject({
      activeSeconds: null,
      effortRpe: null,
      fatigue: null,
    });
    expect(
      reviseDeclaration({
        current: revised,
        expectedRevision: 2,
        value: unknown,
        acceptedSequence: 3,
        asOf: AS_OF,
      }),
    ).toEqual(revised);
    expect(() =>
      reviseDeclaration({
        current: revised,
        expectedRevision: 1,
        value: unknown,
        acceptedSequence: 3,
        asOf: AS_OF,
      }),
    ).toThrow('SESSION_REPORT_CHANGED');
  });

  it('rejects future facts, RPE zero and positive not_started without turning unknown into zero', () => {
    expect(() => validateSessionInput({ ...sessionValue(), effortRpe: 0 as 1 }, AS_OF)).toThrow(
      'INVALID_REQUEST',
    );
    expect(() =>
      validateSessionInput({ ...sessionValue(), activityDate: '2026-10-17' }, AS_OF),
    ).toThrow('INVALID_REQUEST');
    expect(() =>
      validateSessionInput({ ...sessionValue(), completion: 'not_started' }, AS_OF),
    ).toThrow('INVALID_REQUEST');
    expect(() =>
      validateSessionInput(
        { ...sessionValue(0), completion: 'not_started', activityDate: null },
        AS_OF,
      ),
    ).not.toThrow();
    const source = durationSource();
    source.candidate.basis = 'elapsed';
    const missing = canonicalDuration([source.candidate], 'hash', null);
    expect(missing).toMatchObject({ state: 'missing', activeSeconds: null });
  });

  it('scopes inventory hashes to the declared interval, including relevant external relations', () => {
    const inRange = declaration('inside');
    inRange.value!.activityDate = '2026-10-05';
    const outOfRange = declaration('outside');
    outOfRange.value!.activityDate = '2026-10-15';
    const sessions = normalize([inRange, outOfRange], []).sessions;
    const base = {
      userId: USER,
      timeZone: ZONE,
      periodFrom: '2026-09-28',
      periodThrough: '2026-10-11',
      sessions,
      relations: [],
    };
    const expected = sessionWindowHash(base);
    expect(
      sessionWindowHash({ ...base, sessions: sessions.filter((s) => s.id === 'inside') }),
    ).toBe(expected);
    expect(sessionWindowHash({ ...base, periodThrough: '2026-10-18' })).not.toBe(expected);
    expect(
      sessionWindowHash({
        ...base,
        relations: [
          {
            userId: USER,
            id: 'external',
            revision: 1,
            members: ['inside', 'outside'],
            action: 'distinct_sessions',
          },
        ],
      }),
    ).not.toBe(expected);
  });

  it('is order-independent, does not mutate inputs, rejects data from another account', () => {
    const reports: SessionDeclaration[] = [declaration('one'), declaration('two')];
    reports[1].value!.activityDate = '2026-10-14';
    const before = structuredClone(reports);
    expect(normalize(reports, [])).toEqual(normalize([...reports].reverse(), []));
    expect(reports).toEqual(before);
    reports[0].userId = 'account-b';
    expect(() => normalize(reports, [])).toThrow('ACCOUNT_SCOPE_MISMATCH');
  });

  it('withdrawal preserves activity identity without requiring an extra relation', () => {
    const report = linked();
    const withdrawn = reviseDeclaration({
      current: report,
      expectedRevision: 1,
      value: null,
      acceptedSequence: 2,
      asOf: AS_OF,
    });
    const result = normalize([withdrawn]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].memberIds).toEqual(['import-1', 'session-1']);
    expect(result.sessions[0].observation).toMatchObject({ activeSeconds: 1830, effortRpe: null });
  });

  it('legacy ratings choose latest (createdAt,id) and cannot override or revive a v1 head', () => {
    const source = durationSource();
    const ratings = [
      {
        userId: USER,
        id: 'a',
        sessionId: 'import-1',
        createdAt: '2026-10-15T12:00:00Z',
        effortRpe: 4 as const,
        fatigue: 3 as const,
      },
      {
        userId: USER,
        id: 'b',
        sessionId: 'import-1',
        createdAt: '2026-10-15T12:00:00Z',
        effortRpe: 8 as const,
        fatigue: null,
      },
    ];
    const base = {
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      sources: [source],
      relations: [],
      resolutions: [],
      barriers: [],
      legacyFeedback: ratings,
    };
    expect(
      normalizeDurationSessions({ ...base, declarations: [] }).sessions[0].observation,
    ).toMatchObject({ effortRpe: 8, fatigue: null, feedbackExplicit: false });
    const report = linked();
    const withdrawn = reviseDeclaration({
      current: report,
      expectedRevision: 1,
      value: null,
      acceptedSequence: 2,
      asOf: AS_OF,
    });
    expect(
      normalizeDurationSessions({ ...base, declarations: [withdrawn] }).sessions[0].observation,
    ).toMatchObject({ effortRpe: null, fatigue: null, feedbackExplicit: false });
  });

  it('timezone changes regroup real instants but require confirmation for date-only reports', () => {
    const report = declaration();
    report.value!.timeZone = 'UTC';
    expect(normalize([report], []).sessions[0]).toMatchObject({
      dateAmbiguous: true,
      observation: { activityDate: null },
    });
    report.value!.startedAt = '2026-10-15T01:00:00Z';
    report.value!.endedAt = '2026-10-15T01:30:00Z';
    const result = normalize([report], []);
    expect(result.sessions[0]).toMatchObject({
      dateAmbiguous: false,
      observation: { activityDate: '2026-10-14' },
    });
  });

  it('explicit nonexecution conflicting with a positive independent source remains a history conflict', () => {
    const report = linked(0);
    report.value!.completion = 'not_started';
    const result = normalize([report]);
    expect(result.sessions[0].observation.activeSeconds).toBe(1830);
    expect(result.conflicts.map((c) => c.kind)).toContain('history');
  });
});
