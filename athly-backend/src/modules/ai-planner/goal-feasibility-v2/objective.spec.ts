import {
  assessGoal,
  averageWeeklyMeters,
  coverageContains,
  eligibleIndex,
  equivalentSeconds,
  evaluateGoal,
  goalAlternatives,
  mergeObjectiveCapture,
  normalizeObjectiveEvidence,
  objectivePaceContext,
  validIndex,
} from './objective';
import type { ObjectiveCapture, ObjectiveEvidence } from './objective';
import { addDays, evaluationExpiresAt, localDate, startOfDate } from './core';
import { AS_OF, capture, GOAL, objectiveFixture, recordedRun, USER, ZONE } from './test-fixtures';

function normalize(
  upload: ObjectiveCapture | null,
  asOf = '2026-10-15T12:00:00Z',
  lastReadState: ObjectiveEvidence['lastReadState'] = 'complete',
) {
  return normalizeObjectiveEvidence({
    userId: USER,
    asOf,
    timeZone: ZONE,
    capture: upload,
    lastReadState,
  });
}

describe('D15 objective evidence and target assessment', () => {
  const central = objectiveFixture();
  const favorable = objectiveFixture(true);

  it('T1: evaluates the independently specified central fixture and rounded alternatives', () => {
    const assessment = assessGoal(GOAL, central.evidence);
    expect(averageWeeklyMeters(central.evidence, 6)).toEqual({
      value: 20000,
      observedLowerBoundMeters: 20000,
    });
    expect(averageWeeklyMeters(central.evidence, 4).value).toBe(20000);
    expect(assessment.assessment).toMatchObject({
      current: 'not_supported',
      byDate: 'not_supported',
      confidence: 'medium',
      performance: { state: 'insufficient_data' },
      endurance: { state: 'not_supported' },
    });
    expect(assessment.performance.requiredVdot).toBeCloseTo(50.9765, 3);
    expect(assessment.performance.observedEquivalentVdot).toBeCloseTo(40.0121, 3);
    const alternatives = goalAlternatives('evaluation-central', GOAL, central.evidence);
    expect(
      alternatives.map((a) => [
        a.axis,
        a.target.distanceMeters,
        a.target.timeSeconds,
        a.assessment.current,
        a.assessment.confidence,
      ]),
    ).toEqual([
      ['distance', 13300, 5400, 'supported', 'medium'],
      ['both', 13300, 4080, 'supported', 'medium'],
    ]);
    expect(
      alternatives.every((a) => a.target.eventDate === '2026-10-22' && a.target.timeZone === ZONE),
    ).toBe(true);
  });

  it('T2: favorable fixture supports the half marathon without already running that distance', () => {
    const result = assessGoal(GOAL, favorable.evidence);
    expect(averageWeeklyMeters(favorable.evidence, 6).value).toBe(42000);
    expect(result.assessment).toMatchObject({
      current: 'supported',
      confidence: 'medium',
      performance: { state: 'supported' },
      endurance: { state: 'supported' },
    });
    expect(result.performance.equivalentTimeNowSeconds).toBeCloseTo(5312.823, 2);
    expect(goalAlternatives('favorable', GOAL, favorable.evidence)).toEqual([]);
  });

  it('T3/D15: neither training nor a declared maximum below the requirement establishes incapacity', () => {
    const upload = structuredClone(central.capture);
    upload.runs.at(-1)!.assertion = {
      intent: 'maximal',
      continuity: 'continuous',
      conditions: 'comparable',
      assertedAt: upload.capturedAt,
    };
    const first = assessGoal(GOAL, normalize(upload));
    expect(first.assessment.performance.state).toBe('insufficient_data');
    upload.runs.at(-1)!.assertion = null;
    const second = assessGoal(GOAL, normalize(upload));
    expect(second.performance.observedEquivalentVdot).toBe(
      first.performance.observedEquivalentVdot,
    );
    upload.coverage.assertion = null;
    expect(assessGoal(GOAL, normalize(upload)).assessment.endurance.state).toBe(
      'insufficient_data',
    );
    expect(
      goalAlternatives('no-assertion', GOAL, normalize(upload)).map((a) => a.target.distanceMeters),
    ).toEqual([13300, 13300]);
  });

  it('uses elapsed 3300s instead of active 3000s and never certifies continuity from empty events', () => {
    const run = recordedRun(1, '2026-10-14', 10000, 3300);
    run.durationSeconds = 3000;
    run.observation!.pauses = { method: 'events', intervals: [] };
    const evidence = normalize(capture([run]));
    expect(evidence.runs[0]).toMatchObject({
      durationSeconds: 3000,
      elapsedSeconds: 3300,
      continuity: 'unknown',
      userEntered: null,
    });
    expect(evidence.efforts[0].index).toBeCloseTo(35.7744, 3);
    run.observation!.endDate = null;
    const withoutEnd = normalize(capture([run]));
    expect(withoutEnd.runs[0]).toMatchObject({
      volumeEligible: true,
      exposureEligible: false,
      elapsedSeconds: null,
    });
    expect(withoutEnd.efforts).toEqual([]);
    expect(objectivePaceContext(withoutEnd, GOAL).H).toBeNull();
  });

  it.each(['manual', 'prescribed', 'unknown'] as const)(
    'does not promote %s to objective evidence',
    (source) => {
      const run = recordedRun(1, '2026-10-14', 10000, 3000);
      run.observation!.measurementSource = source;
      const evidence = normalize(capture([run]));
      expect(evidence.runs[0].volumeEligible).toBe(false);
      expect(evidence.efforts).toEqual([]);
    },
  );

  it('keeps legacy values and done status from manufacturing execution', () => {
    const run = recordedRun(1, '2026-10-14', 10000, 3000);
    run.observation = null;
    const input = { ...run, status: 'done', prescribedDistanceMeters: 10000 };
    const evidence = normalize(capture([input]));
    expect(evidence.runs[0]).toMatchObject({ provenance: 'unknown', volumeEligible: false });
    expect(averageWeeklyMeters(evidence, 4).value).toBe(0);
    expect(evidence.efforts).toEqual([]);
  });

  it('admits individual observed splits, excludes synthetic/prescribed ones, and never joins intervals', () => {
    const run = recordedRun(1, '2026-10-14', 10000, 3300);
    run.observation!.pauses = {
      method: 'events',
      intervals: [{ startOffsetSeconds: 1200, endOffsetSeconds: 1500 }],
    };
    run.segments = [
      {
        id: 'rep-1',
        distanceMeters: 4000,
        observation: {
          startOffsetSeconds: 0,
          endOffsetSeconds: 1200,
          durationBasis: 'active',
          distanceSource: 'events',
        },
      },
      {
        id: 'rep-2',
        distanceMeters: 6000,
        observation: {
          startOffsetSeconds: 1500,
          endOffsetSeconds: 3300,
          durationBasis: 'active',
          distanceSource: 'route',
        },
      },
    ];
    const evidence = normalize(capture([run]));
    expect(evidence.runs[0].continuity).toBe('interrupted');
    expect(evidence.efforts.map((e) => [e.distanceMeters, e.elapsedSeconds])).toEqual([
      [10000, 3300],
      [4000, 1200],
      [6000, 1800],
    ]);
    run.segments[0].observation.distanceSource = 'prescribed';
    run.segments[1].observation.distanceSource = 'synthetic';
    expect(normalize(capture([run])).efforts.map((e) => e.id)).toEqual(['run-001']);
  });

  it('rejects overlapping/out-of-range offsets and active duration beyond elapsed tolerance', () => {
    const run = recordedRun(1, '2026-10-14', 5000, 1800);
    run.durationSeconds = 1802;
    expect(normalize(capture([run])).runs[0].volumeEligible).toBe(false);
    run.durationSeconds = 1801;
    expect(normalize(capture([run])).runs[0].volumeEligible).toBe(true);
    run.segments = [
      {
        id: 'bad',
        distanceMeters: 5000,
        observation: {
          startOffsetSeconds: 0,
          endOffsetSeconds: 1800.002,
          durationBasis: 'elapsed',
          distanceSource: 'route',
        },
      },
    ];
    expect(() => normalize(capture([run]))).toThrow('INVALID_REQUEST');
  });

  it('T7: deduplicates identifiers, explicit links and near matches; quarantines divergent links', () => {
    const first = recordedRun(1, '2026-10-14', 10000, 3000);
    const second = recordedRun(2, '2026-10-14', 10000, 3000);
    first.linkedWorkout = second.linkedWorkout = { userId: USER, id: 'workout-1' };
    const linked = normalize(capture([first, second]));
    expect(linked.runs).toHaveLength(1);
    expect(linked.efforts).toHaveLength(1);
    expect(linked.runs[0].distanceMeters).toBe(10000);
    second.distanceMeters = 11000;
    const conflict = normalize(capture([first, second]));
    expect(conflict.runs[0]).toMatchObject({ quarantined: true, volumeEligible: false });
    expect(conflict.efforts).toEqual([]);
    second.distanceMeters = 10000;
    first.linkedWorkout = second.linkedWorkout = null;
    expect(normalize(capture([first, second])).runs).toHaveLength(1);
    second.startDate = '2026-10-14T13:00:00Z';
    second.observation!.endDate = '2026-10-14T13:50:00Z';
    expect(normalize(capture([first, second])).runs).toHaveLength(2);
  });

  it('withdraws only explicit current source revisions and does not count a fragment twice', () => {
    const first = recordedRun(1, '2026-10-14', 10000, 3000);
    const tombstone = { ...structuredClone(first), sourceRevision: 2, withdrawn: true };
    expect(normalize(capture([tombstone, first])).runs).toEqual([]);
    const fragment = recordedRun(2, '2026-10-14', 4000, 1200);
    fragment.parentSourceId = first.sourceId;
    const evidence = normalize(capture([first, fragment]));
    expect(evidence.runs.filter((r) => r.volumeEligible)).toHaveLength(1);
    expect(evidence.efforts.map((e) => e.distanceMeters)).toEqual([10000]);
  });

  it('T4/T20: uses inclusive civil age 42 and excludes day 43 regardless of synchronization date', () => {
    const run = recordedRun(1, '2026-09-03', 10000, 2400);
    expect(eligibleIndex(normalize(capture([run])), 21097.5)?.id).toBe('run-001');
    run.startDate = '2026-09-02T12:00:00Z';
    run.observation!.endDate = '2026-09-02T12:40:00Z';
    expect(eligibleIndex(normalize(capture([run])), 21097.5)).toBeNull();
    expect(assessGoal(GOAL, normalize(capture([run]))).assessment.confidence).toBe('low');
  });

  it('T5: distinguishes empty, absent, partial, failed and stale; preserves useful capture clocks', () => {
    expect(assessGoal(GOAL, normalize(null, AS_OF, null)).assessment.confidence).toBe('none');
    const empty = capture([], '2026-10-16T12:00:00Z');
    const merged = mergeObjectiveCapture(
      { userId: USER, lastAttempt: central.capture, useful: central.capture },
      empty,
    );
    expect(merged.useful!.capturedAt).toBe('2026-10-15T12:00:00Z');
    const failed = structuredClone(empty);
    failed.capturedAt = '2026-10-17T12:00:00Z';
    failed.coverage.state = 'failed';
    failed.coverage.failureCode = 'query_failed';
    const afterFailure = mergeObjectiveCapture(merged, failed);
    expect(afterFailure.useful!.capturedAt).toBe('2026-10-15T12:00:00Z');
    expect(afterFailure.lastAttempt!.coverage.state).toBe('failed');
    expect(() =>
      mergeObjectiveCapture(merged, {
        ...empty,
        coverage: { ...empty.coverage, state: 'partial' },
      }),
    ).toThrow('CAPTURE_CONFLICT');
    const partial = structuredClone(central.capture);
    partial.coverage.state = 'partial';
    partial.coverage.truncated = true;
    expect(averageWeeklyMeters(normalize(partial), 6)).toEqual({
      value: null,
      observedLowerBoundMeters: 20000,
    });
    expect(goalAlternatives('partial', GOAL, normalize(partial))).toEqual([]);
    expect(
      assessGoal(GOAL, normalize(favorable.capture, '2026-10-23T12:00:00Z')).assessment.current,
    ).toBe('insufficient_data');
  });

  it('coverage must fill every interval; missing source IDs in a new capture are not tombstones', () => {
    const previous = capture([recordedRun(1, '2026-10-14', 10000, 3000)]);
    const incoming = capture([recordedRun(2, '2026-10-15', 5000, 1800)], '2026-10-16T12:00:00Z');
    const merged = mergeObjectiveCapture(
      { userId: USER, useful: previous, lastAttempt: previous },
      incoming,
    );
    expect(merged.useful!.runs).toHaveLength(2);
    const c = structuredClone(previous.coverage);
    c.coveredIntervals = [
      { from: c.requestedFrom, to: '2026-10-01T12:00:00Z' },
      { from: '2026-10-01T12:00:01Z', to: c.requestedTo },
    ];
    expect(coverageContains(c, c.requestedFrom, c.requestedTo)).toBe(false);
    expect(mergeObjectiveCapture(merged, previous)).toEqual(merged);
  });

  it('T6: groups measured volume by calendar, rather than the number of old runs', () => {
    const recent = Array.from({ length: 20 }, (_, i) =>
      recordedRun(i + 1, `2026-09-${(21 + (i % 10)).toString().padStart(2, '0')}`, 5000, 1800),
    );
    // Distinct real times keep same-day sessions from approximate deduplication.
    recent.forEach((r, i) => {
      r.startDate = `${r.startDate!.slice(0, 10)}T${(i < 10 ? 12 : 14).toString()}:00:00Z`;
      r.observation!.endDate = new Date(Date.parse(r.startDate) + 1800000).toISOString();
    });
    expect(averageWeeklyMeters(normalize(capture(recent)), 4).value).toBe(25000);
    const sparse = [
      recordedRun(1, '2026-10-03', 5000, 1800),
      recordedRun(2, '2026-10-10', 5000, 1800),
      ...Array.from({ length: 18 }, (_, i) =>
        recordedRun(i + 3, `2026-08-${(i + 1).toString().padStart(2, '0')}`, 5000, 1800),
      ),
    ];
    expect(averageWeeklyMeters(normalize(capture(sparse)), 4).value).toBe(2500);
  });

  it('T18/T19: no time, no date, 1500m, marathon, long horizons and domains stay distinct', () => {
    const marathonRuns = [
      recordedRun(1, '2026-10-05', 42195, 16000),
      recordedRun(2, '2026-10-13', 5000, 1800),
    ];
    const marathon = normalize(capture(marathonRuns));
    expect(
      assessGoal({ ...GOAL, distanceMeters: 42195, timeSeconds: 14400 }, marathon).assessment,
    ).toMatchObject({
      performance: { state: 'insufficient_data' },
      endurance: { state: 'supported' },
    });
    expect(
      assessGoal({ ...GOAL, distanceMeters: 42195, timeSeconds: null }, marathon).assessment
        .current,
    ).toBe('supported');
    expect(assessGoal({ ...GOAL, eventDate: null }, favorable.evidence).assessment.byDate).toBe(
      'unavailable',
    );
    expect(goalAlternatives('undated', { ...GOAL, eventDate: null }, central.evidence)).toEqual([]);
    expect(
      assessGoal({ ...GOAL, distanceMeters: 1500, timeSeconds: null }, normalize(null)).assessment
        .current,
    ).toBe('insufficient_data');
    for (const distanceMeters of [1499, 42196])
      expect(assessGoal({ ...GOAL, distanceMeters }, central.evidence).assessment.current).toBe(
        'unavailable',
      );
    for (const eventDate of ['2026-10-15', '2026-10-14', '2027-10-16']) {
      expect(assessGoal({ ...GOAL, eventDate }, favorable.evidence).assessment.byDate).toBe(
        'unavailable',
      );
      expect(goalAlternatives('invalid-date', { ...GOAL, eventDate }, central.evidence)).toEqual(
        [],
      );
    }
    expect(
      assessGoal({ ...GOAL, eventDate: '2027-04-13' }, favorable.evidence).assessment.byDate,
    ).toBe('conditional');
    expect(assessGoal({ ...GOAL, eventDate: '2027-04-13' }, central.evidence).scenario?.kind).toBe(
      'requirements_not_yet_demonstrated',
    );
  });

  it('validates inputs and inverse bracketing without clamping or defaults', () => {
    expect(validIndex(10000, 3000)).toBeCloseTo(40.0121, 3);
    expect(validIndex(10000, 1000)).toBeNull();
    expect(equivalentSeconds(19.999, 10000)).toBeNull();
    expect(equivalentSeconds(85, 1500)).not.toBeNull();
    expect(() => assessGoal({ ...GOAL, distanceMeters: NaN }, central.evidence)).toThrow(
      'INVALID_REQUEST',
    );
    expect(() => assessGoal({ ...GOAL, eventDate: '2026-02-30' }, central.evidence)).toThrow(
      'INVALID_REQUEST',
    );
    expect(() => assessGoal({ ...GOAL, timeZone: 'Invalid/Zone' }, central.evidence)).toThrow();
  });

  it('uses civil dates across DST and expiry at the next local midnight', () => {
    expect(localDate('2026-10-16T01:00:00Z', ZONE)).toBe('2026-10-15');
    expect(startOfDate('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfDate('2026-03-09', 'America/New_York')).toBe('2026-03-09T04:00:00.000Z');
    expect(evaluationExpiresAt(AS_OF, ZONE)).toBe('2026-10-17T03:00:00.000Z');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is deterministic, preserves inputs and isolates accounts and objective HR-independent hashes', () => {
    const raw = structuredClone(central.capture);
    const original = structuredClone(raw);
    const a = normalize(raw);
    const b = normalize({ ...raw, runs: [...raw.runs].reverse() });
    expect(a).toEqual(b);
    expect(raw).toEqual(original);
    const withHr = { ...raw, runs: raw.runs.map((r) => ({ ...r, avgHeartRate: 180 })) };
    expect(normalize(withHr).evidenceHash).toBe(a.evidenceHash);
    expect(
      evaluateGoal({
        id: 'e1',
        goalId: 'g1',
        goalVersion: 1,
        preferencesHash: 'preferences',
        target: GOAL,
        evidence: a,
      }),
    ).toEqual(
      evaluateGoal({
        id: 'e1',
        goalId: 'g1',
        goalVersion: 1,
        preferencesHash: 'preferences',
        target: GOAL,
        evidence: b,
      }),
    );
    raw.runs[0].userId = 'account-b';
    expect(() => normalize(raw)).toThrow('ACCOUNT_SCOPE_MISMATCH');
  });

  it('T17: re-evaluates rounded time candidates and enforces the minimum 30s change', () => {
    const target = { ...GOAL, timeSeconds: 5300 };
    const alternatives = goalAlternatives('rounding', target, favorable.evidence);
    expect(alternatives[0]).toMatchObject({
      axis: 'time',
      target: { distanceMeters: 21097.5, timeSeconds: 5340 },
      assessment: { current: 'supported' },
    });
    expect(
      new Set(alternatives.map((a) => `${a.target.distanceMeters}/${a.target.timeSeconds}`)).size,
    ).toBe(alternatives.length);
    expect(
      goalAlternatives('under-30s', { ...GOAL, timeSeconds: 5311 }, favorable.evidence).some(
        (a) => a.axis === 'time',
      ),
    ).toBe(false);
  });

  it('empty reading alone never produces a fresh negative conclusion, even with visible zero volume', () => {
    const evidence = normalize(capture([]));
    expect(averageWeeklyMeters(evidence, 4).value).toBe(0);
    expect(assessGoal(GOAL, evidence).assessment).toMatchObject({
      current: 'insufficient_data',
      confidence: 'none',
      endurance: { state: 'insufficient_data' },
    });
  });

  it('contradictory no_running assertion preserves measured executions and exposes the conflict', () => {
    const uploaded = structuredClone(favorable.capture);
    uploaded.coverage.assertion!.kind = 'no_running';
    const evidence = normalize(uploaded);
    expect(evidence.runs.filter((r) => r.volumeEligible)).toHaveLength(19);
    expect(evidence.conflicts[0].code).toBe('HISTORY_ASSERTION_CONFLICT');
    expect(assessGoal(GOAL, evidence).assessment.confidence).toBe('low');
    expect(objectivePaceContext(evidence, GOAL).eligible).toBe(false);
  });

  it('near duplicates with known active time can deduplicate volume without inventing elapsed time', () => {
    const a = recordedRun(1, '2026-10-14', 10000, 3000);
    const b = recordedRun(2, '2026-10-14', 10000, 3030);
    a.observation!.endDate = b.observation!.endDate = null;
    const evidence = normalize(capture([a, b]));
    expect(evidence.runs).toHaveLength(1);
    expect(evidence.runs[0]).toMatchObject({ volumeEligible: true, elapsedSeconds: null });
    expect(evidence.efforts).toEqual([]);
  });
});
