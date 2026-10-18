import {
  checkDosePreconditions,
  commitDoseDelivery,
  latestAdherenceSignal,
  planResumeEpisode,
  proposeDose,
  routineRatingSignal,
  sessionRatingSignal,
  weekAdherence,
} from './control';
import type { DeliveredWeek, DoseSignal } from './control';
import { ENGINE_VERSION, POLICY_VERSION } from './core';
import {
  AS_OF,
  anchor,
  deliveredWeek,
  doseInput,
  existingControl,
  ROUTINE,
  sourceFact,
  USER,
  ZONE,
} from './test-fixtures';

function signal(key = 'fatigue-1', factor: DoseSignal['factor'] = 0.8): DoseSignal {
  return {
    userId: USER,
    occurrenceKey: key,
    aliases: [],
    sourceRevisionIds: ['rating:1'],
    kind: 'ratings',
    on: '2026-10-15',
    factor,
  };
}
function commit(
  input: ReturnType<typeof doseInput>,
  plan = proposeDose(input),
  id = 'delivery-1',
  emitted = [plan.sessionSeconds, plan.sessionSeconds, plan.sessionSeconds],
) {
  return commitDoseDelivery({
    userId: USER,
    state: input.state,
    plan,
    sources: input.sourceFacts,
    event: { id, committedAt: AS_OF, emittedSessionSeconds: emitted },
    previousReceipt: null,
    engineVersion: ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
  });
}
function pair(): DeliveredWeek[] {
  return [deliveredWeek('2026-09-28', '2026-10-04'), deliveredWeek()];
}

describe('pure dose control: occurrence anchors, revisions and explicit positive delivery', () => {
  it('does not consume preview and keeps the same fatigue at 1440 across retries and later weeks', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal()];
    const before = structuredClone(input);
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      sessionSeconds: 1440,
      nominalWeekSeconds: 4320,
      maxRpe: 3,
      adjustment: 'reduce',
    });
    expect(input).toEqual(before);
    expect(proposeDose(input)).toEqual(plan);
    const delivered = commit(input, plan);
    expect(delivered.nextState.receipts).toHaveLength(1);
    input.state = delivered.nextState;
    const second = proposeDose(input);
    expect(second.sessionSeconds).toBe(1440);
    expect(second.appliedSignals).toEqual([]);
    expect(second.maxRpe).toBe(3);
    expect(second.progressionEligible).toBe(false);
    const again = commit(input, second, 'delivery-2');
    expect(again.nextState.reference!.sessionSeconds).toBe(1440);
  });

  it('a genuinely new high-fatigue occurrence may reduce 1440 to 1140', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal()];
    input.state = commit(input).nextState;
    input.signals = [signal('fatigue-2')];
    expect(proposeDose(input)).toMatchObject({ sessionSeconds: 1140, nominalWeekSeconds: 3420 });
  });

  it('worsening the same occurrence uses its original 1800 anchor', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal('moderate', 0.9)];
    input.state = commit(input).nextState;
    expect(input.state.reference!.sessionSeconds).toBe(1620);
    input.signals = [signal('moderate', 0.8)];
    const severe = proposeDose(input);
    expect(severe.sessionSeconds).toBe(1440);
    expect(severe.appliedSignals[0].anchor.sessionSeconds).toBe(1800);
  });

  it.each([
    [0.9, 1440, 4320],
    [0.8, 1290, 3870],
  ] as const)('R4: old worsening and independent new factor %s are intersected', (factor, q, p) => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal('old', 0.9)];
    input.state = commit(input).nextState;
    input.signals = [signal('old', 0.8), signal('new', factor)];
    const plan = proposeDose(input);
    expect(plan).toMatchObject({ sessionSeconds: q, nominalWeekSeconds: p });
    expect(plan.appliedSignals.map((s) => s.anchor.sessionSeconds)).toEqual([1620, 1800]);
  });

  it('new simultaneous signals share the same pre-adjustment anchor rather than compound', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal('one', 0.8), signal('two', 0.9)];
    expect(proposeDose(input).sessionSeconds).toBe(1440);
    expect(proposeDose(input).appliedSignals.map((s) => s.anchor.sessionSeconds)).toEqual([
      1800, 1800,
    ]);
  });

  it('signal aliases prevent reconsumption after canonical sessions merge or divide', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal('session:old')];
    input.state = commit(input).nextState;
    input.signals = [{ ...signal('session:new'), aliases: ['session:old'] }];
    expect(proposeDose(input).sessionSeconds).toBe(1440);
    expect(proposeDose(input).appliedSignals).toEqual([]);
  });

  it('expired or withdrawn old signals do not reimpose a historical ceiling or prevent progression', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal()];
    input.state = commit(input).nextState;
    // A later independent progression has legitimately established this reference.
    input.state.reference!.sessionSeconds = 1500;
    input.state.reference!.nominalWeekSeconds = 4500;
    input.state.progressionBarrier = null;
    input.weeks = pair();
    input.signals[0].on = '2026-10-08';
    const expired = proposeDose(input);
    expect(expired.progressionEligible).toBe(true);
    expect(expired.sessionSeconds).toBe(1560);
    input.signals[0].on = '2026-10-15';
    input.sourceFacts.find((s) => s.id === 'rating:1')!.withdrawn = true;
    expect(proposeDose(input).sessionSeconds).toBe(1560);
  });

  it('ratings are civil-age inclusive at seven days and become inapplicable at eight', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal()];
    input.signals[0].on = '2026-10-09';
    expect(proposeDose(input).sessionSeconds).toBe(1440);
    input.signals[0].on = '2026-10-08';
    expect(proposeDose(input).sessionSeconds).toBe(1800);
  });

  it('two tolerated weeks enable one 5% increase, bounded by actual execution', () => {
    const input = doseInput();
    input.weeks = pair();
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      progressionEligible: true,
      sessionSeconds: 1890,
      nominalWeekSeconds: 5670,
      adjustment: 'progress',
    });
    const state = commit(input, plan).nextState;
    expect(state.progressionConsumedThrough).toBe('2026-10-11');
    input.state = state;
    expect(proposeDose(input)).toMatchObject({ progressionEligible: false, sessionSeconds: 1890 });
    input.state = existingControl();
    input.weeks = pair().map((w) => ({
      ...w,
      opportunities: w.opportunities.map((o) => ({ ...o, actualSeconds: 1620 })),
    }));
    expect(proposeDose(input)).toMatchObject({
      sessionSeconds: 1680,
      nominalWeekSeconds: 5040,
      adjustment: 'reduce',
    });
  });

  it('a quantized 300-second increase consumes its pair once, without accumulated credit', () => {
    const input = doseInput();
    input.state = existingControl(300, 900);
    input.provisionalAnchor = anchor(300, 900);
    input.weeks = pair().map((w) => ({
      ...w,
      opportunities: w.opportunities.map((o) => ({
        ...o,
        prescribedSeconds: 300,
        actualSeconds: 300,
      })),
    }));
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      sessionSeconds: 300,
      nominalWeekSeconds: 900,
      progressionEligible: true,
      adjustment: 'maintain',
    });
    input.state = commit(input, plan).nextState;
    expect(input.state.progressionConsumedThrough).toBe('2026-10-11');
    expect(proposeDose(input).progressionEligible).toBe(false);
  });

  it('requires both weeks after the progression barrier and the consumed pair', () => {
    const input = doseInput();
    input.weeks = pair();
    input.state.progressionBarrier = { on: '2026-09-28', controlRevision: 1 };
    expect(proposeDose(input).progressionEligible).toBe(false);
    input.state.progressionBarrier = { on: '2026-09-27', controlRevision: 2 };
    expect(proposeDose(input).progressionEligible).toBe(false);
    input.weeks.forEach((w) => (w.controlRevisionAfter = 2));
    expect(proposeDose(input).progressionEligible).toBe(true);
  });

  it('frequency changes redistribute the previous budget and forbid simultaneous progression', () => {
    const input = doseInput();
    input.nominalFrequency = 4;
    input.emittedCount = 4;
    input.weeks = pair();
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      changed: true,
      progressionEligible: false,
      sessionSeconds: 1350,
      nominalWeekSeconds: 5400,
    });
  });

  it('partial calendar dose preserves nominal 5400 while emitting 3600', () => {
    const input = doseInput();
    input.emittedCount = 2;
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      sessionSeconds: 1800,
      nominalWeekSeconds: 5400,
      adjustment: 'maintain',
    });
    const result = commit(input, plan, 'partial', [1800, 1800]);
    expect(result.receipt!.commit).toMatchObject({
      nominalWeekSeconds: 5400,
      emittedWeekSeconds: 3600,
    });
    expect(result.nextState.progressionBarrier).toBeNull();
  });

  it('C=661 reduced by 0.90 emits 594, without independently multiplying Q(C)', () => {
    const input = doseInput();
    input.strategy = 'entry';
    input.state = {
      ...existingControl(600, 1800),
      lastDeliveredStrategy: 'entry',
      reference: { ...anchor(600, 1800), entryCeilingSeconds: 661 },
    };
    input.provisionalAnchor = structuredClone(input.state.reference!);
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal('entry-fatigue', 0.9)];
    expect(proposeDose(input)).toMatchObject({
      sessionSeconds: 594,
      entryCeilingSeconds: 594,
      nominalWeekSeconds: 1782,
    });
  });

  it('zero frequency/count and subquantum limits produce no consumption or new reference', () => {
    const input = doseInput();
    input.state = existingControl(20, 60);
    input.provisionalAnchor = anchor(20, 60);
    const plan = proposeDose(input);
    expect(plan.sessionSeconds).toBe(0);
    const result = commit(input, plan, 'zero', []);
    expect(result).toEqual({ status: 'no_delivery', nextState: input.state, receipt: null });
    input.nominalFrequency = 0;
    input.emittedCount = 0;
    expect(proposeDose(input).sessionSeconds).toBe(0);
  });

  it('replays the same explicit delivery without consuming again and rejects changed event bodies', () => {
    const input = doseInput();
    input.sourceFacts.push(sourceFact('rating:1'));
    input.signals = [signal()];
    const plan = proposeDose(input);
    const first = commit(input, plan);
    const replayInput = {
      userId: USER,
      state: first.nextState,
      plan,
      sources: input.sourceFacts,
      event: { id: 'delivery-1', committedAt: AS_OF, emittedSessionSeconds: [1440, 1440, 1440] },
      previousReceipt: first.receipt,
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
    };
    expect(commitDoseDelivery(replayInput)).toEqual({
      status: 'replayed',
      nextState: first.nextState,
      receipt: first.receipt,
    });
    expect(() =>
      commitDoseDelivery({
        ...replayInput,
        event: { ...replayInput.event, emittedSessionSeconds: [1440] },
      }),
    ).toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(() => commitDoseDelivery({ ...replayInput, previousReceipt: null })).toThrow(
      'DOSE_CONTROL_CHANGED',
    );
  });

  it('rejects stale control, source, clock, engine and account preconditions without mutation', () => {
    const input = doseInput();
    const plan = proposeDose(input);
    const before = structuredClone(input);
    const checks = {
      expected: plan.preconditions,
      userId: USER,
      state: input.state,
      sources: input.sourceFacts,
      at: AS_OF,
      engineVersion: ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
    };
    expect(() =>
      checkDosePreconditions({ ...checks, state: { ...checks.state, revision: 2 } }),
    ).toThrow('DOSE_CONTROL_CHANGED');
    expect(() =>
      checkDosePreconditions({ ...checks, sources: [sourceFact('context:1', 2)] }),
    ).toThrow('DOSE_SOURCE_CHANGED');
    expect(() => checkDosePreconditions({ ...checks, at: '2026-10-17T12:00:00Z' })).toThrow(
      'LOCAL_DATE_CHANGED',
    );
    expect(() => checkDosePreconditions({ ...checks, engineVersion: 'old' })).toThrow(
      'ENGINE_CHANGED',
    );
    expect(() => checkDosePreconditions({ ...checks, userId: 'account-b' })).toThrow(
      'ACCOUNT_SCOPE_MISMATCH',
    );
    expect(input).toEqual(before);
  });

  it('rejects a source expiring between preview and commit, at exactly expiresAt', () => {
    const input = doseInput();
    input.sourceFacts[0].expiresAt = '2026-10-16T12:00:01Z';
    const plan = proposeDose(input);
    expect(() =>
      commitDoseDelivery({
        userId: USER,
        state: input.state,
        plan,
        sources: input.sourceFacts,
        event: { id: 'late', committedAt: '2026-10-16T12:00:01Z', emittedSessionSeconds: [1800] },
        previousReceipt: null,
        engineVersion: ENGINE_VERSION,
        policyVersion: POLICY_VERSION,
      }),
    ).toThrow('DOSE_SOURCE_CHANGED');
  });

  it.each([
    [15, 0.8, 1440],
    [28, 0.8, 1440],
    [29, 0.6, 1080],
    [90, 0.6, 1080],
    [91, null, null],
  ] as const)('resume boundary %s days uses the historical anchor once', (days, factor, q) => {
    const lastRunOn = new Date(Date.parse('2026-10-16T00:00:00Z') - days * 86400000)
      .toISOString()
      .slice(0, 10);
    const result = planResumeEpisode({
      userId: USER,
      episodeId: 'resume-1',
      continuityRevisionId: 'continuity:1',
      lastRunOn,
      observedThrough: '2026-10-16',
      asOf: AS_OF,
      timeZone: ZONE,
      historicalAnchor: anchor(),
      existing: null,
    });
    if (factor === null) {
      expect(result).toEqual({ episode: null, contextRequired: true });
      return;
    }
    expect(result.episode).toMatchObject({
      state: 'pending',
      factor,
      maxSessionSeconds: q,
      maxSessionsPerWeek: 3,
    });
    const input = doseInput();
    input.episode = result.episode;
    input.sourceFacts.push(sourceFact('continuity:1'));
    const first = proposeDose(input);
    expect(first).toMatchObject({ sessionSeconds: q, adjustment: 'resume', maxRpe: 3 });
    input.state = commit(input, first).nextState;
    input.episode = input.state.episode;
    expect(input.episode!.state).toBe('active');
    expect(proposeDose(input)).toMatchObject({ sessionSeconds: q, firstResume: false, maxRpe: 3 });
  });

  it('upgrades a pending 28-day episode to 29 days on the same original anchor', () => {
    const pending = planResumeEpisode({
      userId: USER,
      episodeId: 'one',
      continuityRevisionId: 'continuity:1',
      lastRunOn: '2026-09-18',
      observedThrough: '2026-10-16',
      asOf: AS_OF,
      timeZone: ZONE,
      historicalAnchor: anchor(),
      existing: null,
    }).episode;
    const next = planResumeEpisode({
      userId: USER,
      episodeId: 'unused',
      continuityRevisionId: 'continuity:2',
      lastRunOn: '2026-09-18',
      observedThrough: '2026-10-17',
      asOf: '2026-10-17T12:00:00Z',
      timeZone: ZONE,
      historicalAnchor: anchor(1400, 4200),
      existing: pending,
    }).episode;
    expect(next).toMatchObject({
      id: 'one',
      factor: 0.6,
      anchor: { sessionSeconds: 1800 },
      maxSessionSeconds: 1080,
    });
  });

  it('first return run and switching to pace cannot close an episode or grant intensity', () => {
    const pending = planResumeEpisode({
      userId: USER,
      episodeId: 'episode-1',
      continuityRevisionId: 'continuity:1',
      lastRunOn: '2026-09-20',
      observedThrough: '2026-10-16',
      asOf: AS_OF,
      timeZone: ZONE,
      historicalAnchor: anchor(),
      existing: null,
    }).episode!;
    const active = {
      ...pending,
      state: 'active' as const,
      firstDeliveryId: 'first',
      firstDeliveryDate: '2026-10-15',
    };
    expect(
      planResumeEpisode({
        userId: USER,
        episodeId: 'unused',
        continuityRevisionId: 'continuity:2',
        lastRunOn: '2026-10-16',
        observedThrough: '2026-10-16',
        asOf: AS_OF,
        timeZone: ZONE,
        historicalAnchor: anchor(),
        existing: active,
      }).episode!.state,
    ).toBe('active');
    const input = doseInput();
    input.strategy = 'evidence_pace';
    input.episode = active;
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      maxRpe: 3,
      closingEpisode: false,
      sessionSeconds: 1440,
      progressionEligible: false,
    });
  });

  it('closing delivery retains episode caps/RPE3 and consumes the pair before future progress', () => {
    const input = doseInput();
    input.episode = {
      id: 'episode-1',
      state: 'active',
      lastRunBeforeBreak: '2026-09-01',
      observedThrough: '2026-09-25',
      openedFromRevision: 'continuity:1',
      anchor: anchor(),
      factor: 0.8,
      firstDeliveryId: 'first',
      firstDeliveryDate: '2026-09-25',
      maxSessionsPerWeek: 3,
      maxSessionSeconds: 1440,
      maxWeekSeconds: 4320,
      closedByWeekIds: [],
    };
    input.state = existingControl(1440, 4320);
    input.state.episode = structuredClone(input.episode);
    input.weeks = pair();
    const plan = proposeDose(input);
    expect(plan).toMatchObject({
      closingEpisode: true,
      maxRpe: 3,
      sessionSeconds: 1440,
      progressionEligible: false,
    });
    const next = commit(input, plan).nextState;
    expect(next.episode).toMatchObject({
      state: 'closed',
      closedByWeekIds: ['week-2026-09-28', 'week-2026-10-05'],
    });
    expect(next.progressionConsumedThrough).toBe('2026-10-11');
    expect(next.progressionBarrier).toEqual({ on: '2026-10-16', controlRevision: 2 });
  });

  it('a new interruption after confirmed return anchors to the current reduced reference', () => {
    const active = {
      id: 'old-episode',
      state: 'active' as const,
      lastRunBeforeBreak: '2026-09-01',
      observedThrough: '2026-09-25',
      openedFromRevision: 'continuity:old',
      anchor: anchor(),
      factor: 0.8 as const,
      firstDeliveryId: 'old-delivery',
      firstDeliveryDate: '2026-09-25',
      maxSessionsPerWeek: 3,
      maxSessionSeconds: 1440,
      maxWeekSeconds: 4320,
      closedByWeekIds: [],
    };
    const planned = planResumeEpisode({
      userId: USER,
      episodeId: 'new-episode',
      continuityRevisionId: 'continuity:new',
      lastRunOn: '2026-10-01',
      observedThrough: '2026-10-16',
      asOf: AS_OF,
      timeZone: ZONE,
      historicalAnchor: anchor(),
      currentReference: anchor(1440, 4320),
      existing: active,
    });
    expect(planned.episode).toMatchObject({
      id: 'new-episode',
      state: 'pending',
      anchor: { sessionSeconds: 1440 },
      maxSessionSeconds: 1152,
    });
    const input = doseInput();
    input.state = existingControl(1440, 4320);
    input.state.episode = active;
    input.episode = planned.episode;
    input.sourceFacts.push(sourceFact('continuity:new'));
    const plan = proposeDose(input);
    expect(plan.sessionSeconds).toBe(1140);
    const result = commit(input, plan);
    expect(result.receipt!.episodeTransitions.map((e) => [e.id, e.state])).toEqual([
      ['old-episode', 'superseded'],
      ['new-episode', 'active'],
    ]);
  });

  it('revising the original interruption after its closure cannot reopen it', () => {
    const closed = {
      id: 'closed-episode',
      state: 'closed' as const,
      lastRunBeforeBreak: '2026-09-01',
      observedThrough: '2026-09-25',
      openedFromRevision: 'continuity:old',
      anchor: anchor(),
      factor: 0.8 as const,
      firstDeliveryId: 'old-delivery',
      firstDeliveryDate: '2026-09-25',
      maxSessionsPerWeek: 3,
      maxSessionSeconds: 1440,
      maxWeekSeconds: 4320,
      closedByWeekIds: ['w1', 'w2'],
    };
    expect(
      planResumeEpisode({
        userId: USER,
        episodeId: 'unused-new-id',
        continuityRevisionId: 'continuity:revised',
        lastRunOn: '2026-09-01',
        observedThrough: '2026-10-16',
        asOf: AS_OF,
        timeZone: ZONE,
        historicalAnchor: anchor(),
        currentReference: anchor(1440, 4320),
        existing: closed,
      }).episode,
    ).toEqual(closed);
  });
});

describe('adherence intervals and source identities', () => {
  it('unknown done/partial execution is [0,1], explicit not_started is [0,0], zero denominator is null', () => {
    const week = deliveredWeek();
    week.opportunities.forEach((o) => (o.actualSeconds = null));
    expect(weekAdherence(week)).toMatchObject({ aMin: 0, aMax: 1, tolerated: false });
    week.opportunities.forEach((o) => (o.completion = 'partial'));
    expect(weekAdherence(week).aMax).toBe(1);
    week.opportunities.forEach((o) => (o.completion = 'not_started'));
    expect(weekAdherence(week)).toMatchObject({ aMin: 0, aMax: 0, tolerated: false });
    week.opportunities = [];
    expect(weekAdherence(week)).toMatchObject({ aMin: null, aMax: null, tolerated: false });
  });

  it('excess duration never pays credit for another opportunity', () => {
    const week = deliveredWeek();
    week.opportunities[0].actualSeconds = 5400;
    week.opportunities[1].actualSeconds = 0;
    week.opportunities[2].actualSeconds = 0;
    expect(weekAdherence(week).aMin).toBeCloseTo(1 / 3);
  });

  it('missing ratings, partial completion and late inventory cannot prove a tolerated week', () => {
    for (const mutate of [
      (w: DeliveredWeek) => {
        w.opportunities[0].effortRpe = null;
      },
      (w: DeliveredWeek) => {
        w.opportunities[0].feedbackExplicit = false;
      },
      (w: DeliveredWeek) => {
        w.opportunities[0].completion = 'partial';
      },
      (w: DeliveredWeek) => {
        w.deliveredOn = w.from;
      },
      (w: DeliveredWeek) => {
        w.completeExpectedInventory = false;
      },
    ]) {
      const week = deliveredWeek();
      mutate(week);
      expect(weekAdherence(week).tolerated).toBe(false);
    }
  });

  it('low adherence uses the latest complete delivered week with opportunities, with exact 0.80 boundary', () => {
    const older = deliveredWeek('2026-09-28', '2026-10-04', 900);
    const newer = deliveredWeek('2026-10-05', '2026-10-11', 1440);
    expect(latestAdherenceSignal(USER, [older, newer], AS_OF, ZONE)).toBeNull();
    newer.opportunities.forEach((o) => (o.actualSeconds = 1439));
    expect(latestAdherenceSignal(USER, [older, newer], AS_OF, ZONE)).toMatchObject({
      occurrenceKey: 'adherence:week-2026-10-05',
      factor: 0.8,
    });
  });

  it('routine revisions keep occurrence identity and do not redate the fact', () => {
    const one = routineRatingSignal(USER, ROUTINE);
    const two = routineRatingSignal(USER, {
      ...ROUTINE,
      revision: 2,
      currentFatigue: 8,
      confirmedAt: '2026-10-17T12:00:00Z',
    });
    expect(two.occurrenceKey).toBe(one.occurrenceKey);
    expect(two.on).toBe('2026-10-15');
    expect(two.factor).toBe(0.8);
    expect(
      sessionRatingSignal(USER, {
        duration: {
          activeSeconds: null,
          candidateId: null,
          provenance: 'unknown',
          state: 'missing',
          inputsHash: 'hash',
          resolutionId: null,
        },
        activeSeconds: null,
        activityDate: null,
        canonicalSessionId: 'unknown',
        sessionKey: 'unknown',
        workoutId: null,
        source: 'legacy_unknown',
        provenance: 'unknown',
        activityKind: 'unknown',
        completion: 'unknown',
        effortRpe: null,
        fatigue: null,
        feedbackExplicit: false,
        feedbackReferenceId: null,
        referenceIds: [],
      }),
    ).toBeNull();
  });
});
