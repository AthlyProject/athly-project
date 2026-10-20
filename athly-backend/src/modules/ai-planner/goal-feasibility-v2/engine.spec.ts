import {
  checkDosePreconditions,
  checkEvaluationPreconditions,
  commitDoseDelivery,
  createPrescription,
  ENGINE_VERSION,
  evaluateFeasibility,
  normalizeObjectiveEvidence,
  POLICY_VERSION,
  unifySignalReceiptAliases,
  validateAttempts,
} from './index';
import {
  AS_OF,
  capture,
  doseInput,
  existingControl,
  objectiveFixture,
  prescriptionInput,
  recordedRun,
  ROUTINE,
  sourceFact,
  USER,
  ZONE,
} from './test-fixtures';
import { proposeDose } from './control';

describe('exported pure engine facade and reviewable preconditions', () => {
  it('returns the full evaluation with explicit prescription and original-origin evidence', () => {
    const input = prescriptionInput();
    const result = evaluateFeasibility({
      evaluationId: 'e1',
      goalId: 'g1',
      goalVersion: 7,
      preferencesHash: 'prefs',
      prescriptionInput: input,
    });
    expect(result.evaluation).toMatchObject({
      schemaVersion: 2,
      id: 'e1',
      goalId: 'g1',
      goalVersion: 7,
      engineVersion: ENGINE_VERSION,
      asOf: AS_OF,
      expiresAt: '2026-10-17T03:00:00.000Z',
      assessment: { current: 'insufficient_data', confidence: 'none' },
      prescription: { strategy: 'duration_rpe', bounds: { maxWeekSeconds: 5400 } },
      evidence: [],
    });
    expect(result.evaluation.performance).toMatchObject({
      observedEquivalentVdot: null,
      projectedVdot: null,
    });
  });

  it('acceptance rejects equality at expiresAt, foreign ownership and obsolete version/hash/engine facts', () => {
    const input = prescriptionInput();
    const evaluation = evaluateFeasibility({
      evaluationId: 'e1',
      goalId: 'g1',
      goalVersion: 7,
      preferencesHash: 'prefs',
      prescriptionInput: input,
    }).evaluation;
    const current = {
      userId: USER,
      evaluationOwnerId: USER,
      evaluation,
      at: AS_OF,
      goalId: 'g1',
      goalVersion: 7,
      currentTarget: input.target,
      evidenceHash: evaluation.evidenceHash,
      preferencesHash: 'prefs',
      engineVersion: ENGINE_VERSION,
    };
    expect(() => checkEvaluationPreconditions(current)).not.toThrow();
    expect(() => checkEvaluationPreconditions({ ...current, at: evaluation.expiresAt })).toThrow(
      'EVALUATION_EXPIRED',
    );
    expect(() => checkEvaluationPreconditions({ ...current, goalVersion: 8 })).toThrow(
      'GOAL_VERSION_CHANGED',
    );
    expect(() =>
      checkEvaluationPreconditions({
        ...current,
        currentTarget: { ...input.target, distanceMeters: 10000 },
      }),
    ).toThrow('GOAL_VERSION_CHANGED');
    expect(() => checkEvaluationPreconditions({ ...current, evidenceHash: 'changed' })).toThrow(
      'EVIDENCE_CHANGED',
    );
    expect(() => checkEvaluationPreconditions({ ...current, preferencesHash: 'changed' })).toThrow(
      'PREFERENCES_CHANGED',
    );
    expect(() => checkEvaluationPreconditions({ ...current, engineVersion: 'old' })).toThrow(
      'ENGINE_CHANGED',
    );
    expect(() =>
      checkEvaluationPreconditions({ ...current, evaluationOwnerId: 'account-b' }),
    ).toThrow('EVALUATION_NOT_FOUND');
  });

  it('uses the explicit clock without consulting Date.now or generating random IDs', () => {
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('global clock forbidden');
    });
    try {
      const input = prescriptionInput();
      const first = evaluateFeasibility({
        evaluationId: 'caller-id',
        goalId: 'g1',
        goalVersion: 1,
        preferencesHash: 'prefs',
        prescriptionInput: input,
      });
      expect(first).toEqual(
        evaluateFeasibility({
          evaluationId: 'caller-id',
          goalId: 'g1',
          goalVersion: 1,
          preferencesHash: 'prefs',
          prescriptionInput: input,
        }),
      );
      expect(clock).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it('uses objective execution to answer recency without demanding a duplicate continuity report', () => {
    const input = prescriptionInput();
    input.baselineInput.continuity = null;
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: capture([recordedRun(1, '2026-10-15', 500, 300)], AS_OF),
      lastReadState: 'complete',
    });
    input.objectiveSourceId = 'objective:1';
    input.sourceFacts.push(sourceFact('objective:1'));
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'duration_rpe',
      bounds: { maxSessionSeconds: 1800 },
    });
    expect(result.dosePlan!.preconditions.sourceFacts.map((s) => s.id)).toContain('objective:1');
    const withdrawn = input.sourceFacts.map((s) => ({ ...s, withdrawn: s.id === 'objective:1' }));
    expect(() =>
      checkDosePreconditions({
        expected: result.dosePlan!.preconditions,
        userId: USER,
        state: input.state,
        sources: withdrawn,
        at: AS_OF,
        engineVersion: ENGINE_VERSION,
        policyVersion: POLICY_VERSION,
      }),
    ).toThrow('DOSE_SOURCE_CHANGED');
  });

  it('keeps duration available with an old failed objective capture when independent current context suffices', () => {
    const input = prescriptionInput();
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: capture([recordedRun(1, '2026-10-07', 5000, 1800)], '2026-10-08T12:00:00Z'),
      lastReadState: 'failed',
    });
    input.objectiveSourceId = 'old-objective';
    input.sourceFacts.push({ ...sourceFact('old-objective'), expiresAt: '2026-10-15T12:00:00Z' });
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'duration_rpe',
      attemptEligible: false,
      bounds: { maxWeekSeconds: 5400 },
    });
    expect(result.dosePlan!.preconditions.sourceFacts.map((s) => s.id)).not.toContain(
      'old-objective',
    );
  });

  it('strategy-specific freshness deadline is checked independently from source existence', () => {
    const input = doseInput();
    input.strategy = 'evidence_pace';
    input.validThrough = '2026-10-16T12:00:01Z';
    const plan = proposeDose(input);
    const current = {
      expected: plan.preconditions,
      userId: USER,
      state: input.state,
      sources: input.sourceFacts,
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
    };
    expect(() => checkDosePreconditions({ ...current, at: '2026-10-16T12:00:01Z' })).not.toThrow();
    expect(() => checkDosePreconditions({ ...current, at: '2026-10-16T12:00:01.001Z' })).toThrow(
      'DOSE_INPUT_EXPIRED',
    );
  });

  it('commits identity aliases once and preserves them through a later split with no aliases supplied', () => {
    const input = doseInput();
    input.state = existingControl(1440, 4320);
    input.state.receipts = [
      {
        occurrenceKey: 'session:old',
        aliases: [],
        sourceRevisionIds: ['retired-rating'],
        anchor: existingControl().reference!,
        strongestAppliedFactor: 0.8,
        firstCommittedDeliveryId: 'old',
        lastCommittedDeliveryId: 'old',
      },
    ];
    input.receiptAliasGroups = [
      ['session:old', 'session:merged'],
      ['session:merged', 'session:new'],
    ];
    const plan = proposeDose(input);
    const event = { id: 'aliased', committedAt: AS_OF, emittedSessionSeconds: [1440, 1440, 1440] };
    const delivered = commitDoseDelivery({
      userId: USER,
      state: input.state,
      plan,
      sources: input.sourceFacts,
      event,
      previousReceipt: null,
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
    });
    expect(delivered.nextState.receipts[0].aliases).toContain('session:new');
    input.state = delivered.nextState;
    input.receiptAliasGroups = [];
    input.signals = [
      {
        userId: USER,
        occurrenceKey: 'session:new',
        aliases: [],
        sourceRevisionIds: ['new-rating'],
        kind: 'ratings',
        on: '2026-10-15',
        factor: 0.8,
      },
    ];
    input.sourceFacts.push(sourceFact('new-rating'));
    expect(proposeDose(input)).toMatchObject({ sessionSeconds: 1440, appliedSignals: [] });
    expect(
      unifySignalReceiptAliases(input.state.receipts, [
        ['a', 'b'],
        ['session:new', 'b'],
      ]),
    ).toEqual(
      unifySignalReceiptAliases(input.state.receipts, [
        ['session:new', 'b'],
        ['a', 'b'],
      ]),
    );
  });

  it('limits generation validation to three attempts and applies the frozen fallback after all fail', () => {
    const frozen = createPrescription(prescriptionInput()).frozen!;
    const invalid = frozen.expectedTrees.map((t) => ({
      date: t.date,
      sport: 'RUNNING' as const,
      segments: [],
    }));
    const result = validateAttempts(frozen, [invalid, invalid, invalid]);
    expect(result).toMatchObject({
      source: 'fallback',
      attemptsUsed: 3,
      rejectedCodes: ['EMPTY_WORKOUT', 'EMPTY_WORKOUT', 'EMPTY_WORKOUT'],
    });
    expect(result.workouts.map((w) => w.maximumSeconds)).toEqual([1800, 1800, 1800]);
    expect(() => validateAttempts(frozen, [invalid, invalid, invalid, invalid])).toThrow(
      'INVALID_REQUEST',
    );
  });

  it.each([
    ['2026-09-20', 1440, 4320],
    ['2026-08-17', 1080, 3240],
  ] as const)(
    'prescription resumes from historical source at %s, then preserves the active episode',
    (lastRunOn, q, p) => {
      const input = prescriptionInput();
      input.baselineInput.routine = null;
      input.baselineInput.continuity!.lastRunOn = lastRunOn;
      const historical = {
        ...ROUTINE,
        periodFrom: lastRunOn === '2026-09-20' ? '2026-09-01' : '2026-08-01',
        periodThrough: lastRunOn === '2026-09-20' ? '2026-09-14' : '2026-08-14',
      };
      input.historicalResume = {
        anchor: existingControl().reference!,
        routine: historical,
        sessions: [],
        sourceIds: ['routine:routine-1:1'],
      };
      const first = createPrescription(input);
      expect(first.prescription).toMatchObject({
        strategy: 'duration_rpe',
        adjustment: 'resume',
        bounds: { maxSessionSeconds: q, maxWeekSeconds: p, maxRpe: 3 },
      });
      const committed = commitDoseDelivery({
        userId: USER,
        state: input.state,
        plan: first.dosePlan!,
        sources: input.sourceFacts,
        event: { id: 'resume-first', committedAt: AS_OF, emittedSessionSeconds: [q, q, q] },
        previousReceipt: null,
        engineVersion: ENGINE_VERSION,
        policyVersion: POLICY_VERSION,
      });
      input.state = committed.nextState;
      const second = createPrescription(input);
      expect(second.prescription).toMatchObject({
        strategy: 'duration_rpe',
        attemptEligible: false,
        bounds: { maxSessionSeconds: q, maxWeekSeconds: p, maxRpe: 3 },
      });
      expect(second.dosePlan!.firstResume).toBe(false);
      input.sourceFacts.find((s) => s.id === 'routine:routine-1:1')!.withdrawn = true;
      expect(createPrescription(input).prescription.strategy).toBe('context_required');
    },
  );

  it('missing historical reference for a confirmed short interruption requests context despite a new aggregated routine', () => {
    const input = prescriptionInput();
    input.baselineInput.continuity!.lastRunOn = '2026-09-20';
    expect(createPrescription(input).prescription.strategy).toBe('context_required');
    input.baselineInput.continuity!.lastRunOn = '2026-07-01';
    input.baselineInput.routine = null;
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'context_required',
      experience: { level: 'experienced' },
    });
  });

  it('a fresh capture that no longer covers the latest complete weeks does not sustain pace', () => {
    const fixture = objectiveFixture(true);
    const input = prescriptionInput();
    input.baselineInput.asOf = input.calendar.asOf = '2026-10-22T11:59:59Z';
    input.calendar.weekStart = '2026-10-26';
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: input.calendar.asOf,
      timeZone: ZONE,
      capture: fixture.capture,
      lastReadState: 'complete',
    });
    expect(input.objective.fresh).toBe(true);
    expect(createPrescription(input).prescription.strategy).toBe('duration_rpe');
  });

  it('rounding objective meters to zero keeps evidence_pace without sessions or consumption', () => {
    const input = prescriptionInput();
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: capture(
        [recordedRun(1, '2026-10-06', 100, 60), recordedRun(2, '2026-10-15', 10000, 2400)],
        AS_OF,
      ),
      lastReadState: 'complete',
    });
    input.objectiveSourceId = 'objective:1';
    input.sourceFacts.push(sourceFact('objective:1'));
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'evidence_pace',
      delivery: 'no_sessions',
      sessions: [],
      attemptEligible: false,
    });
  });

  it('a 1500m goal retains duration/RPE without claiming a distance certificate', () => {
    const input = prescriptionInput();
    input.target.distanceMeters = 1500;
    input.target.timeSeconds = null;
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      goalSupport: 'insufficient_data',
      attemptEligible: false,
      bounds: { maxSessionMeters: null, maxWeekMeters: null, maxSessionSeconds: 1800 },
    });
  });
});
