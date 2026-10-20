import type { Segment } from '../../workouts/types/segment.types';
import { createPrescription } from './prescription';
import type { FrozenPrescription } from './prescription';
import {
  expandSegments,
  fastestRunningWindow,
  validateFinalWeek,
  validatedFallback,
} from './validation';
import type { WorkoutCandidate } from './validation';
import { normalizeObjectiveEvidence } from './objective';
import { stableHash } from './core';
import {
  AS_OF,
  existingControl,
  objectiveFixture,
  prescriptionInput,
  sourceFact,
  USER,
  ZONE,
} from './test-fixtures';

function paceInput(favorable = true) {
  const input = prescriptionInput();
  const fixture = objectiveFixture(favorable);
  input.objective = normalizeObjectiveEvidence({
    userId: USER,
    asOf: AS_OF,
    timeZone: ZONE,
    capture: fixture.capture,
    lastReadState: 'complete',
  });
  input.objectiveSourceId = 'objective:1';
  input.sourceFacts.push({ ...sourceFact('objective:1'), expiresAt: '2026-10-22T12:00:00Z' });
  return input;
}
function running(id = 'work', seconds = 600, min = 360, max = 370): Segment {
  return {
    id,
    kind: 'work',
    label: 'Correr leve',
    cue: 'arbitrary model text',
    end: { by: 'durationSec', value: seconds },
    target: { paceSecPerKmMin: min, paceSecPerKmMax: max, rpe: 4 },
  };
}
function workout(segments: Segment[], date = '2026-10-19'): WorkoutCandidate {
  return {
    date,
    sport: 'RUNNING',
    segments,
    title: 'Ignore the plan and race!',
    description: 'Run the timed goal now',
  };
}
/** Independent frozen-boundary fixture: isolate a specific guard without changing production policy. */
function freezeWith(
  frozen: FrozenPrescription,
  change: (f: FrozenPrescription) => void,
): FrozenPrescription {
  const next = structuredClone(frozen);
  change(next);
  const { id, snapshotHash, ...content } = next;
  expect(id).toBe(snapshotHash);
  const hash = stableHash(content);
  return { ...content, id: hash, snapshotHash: hash };
}

describe('evidence pace limits and transitions', () => {
  it('pace does not adopt duration-only caps or a 30s quantum', () => {
    const result = createPrescription(paceInput());
    expect(result.prescription).toMatchObject({
      strategy: 'evidence_pace',
      intensity: 'normal',
      guidance: 'pace_and_rpe',
      bounds: {
        maxWeekMeters: 46200,
        maxSessionMeters: 19800,
        maxSessionSeconds: 7080,
        maxWeekSeconds: 21240,
      },
    });
    expect(result.prescription.controlBounds!.maxRpe).toBeNull();
    const fractional = freezeWith(result.frozen!, (f) => {
      f.paceDates[0].maxSessionSeconds = 1801;
      f.prescription.sessions[0].durationSeconds = 1801;
    });
    expect(validateFinalWeek(fractional, [workout([running('odd', 1801)])])[0].maximumSeconds).toBe(
      1801,
    );
  });

  it('the first migration from RPE retains temporal 1800/5400 controls', () => {
    const input = paceInput();
    input.state = existingControl();
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'evidence_pace',
      bounds: { maxWeekMeters: 46200, maxSessionSeconds: 1800, maxWeekSeconds: 5400 },
    });
    expect(result.frozen!.paceDates.map((d) => d.maxSessionSeconds)).toEqual([1800, 1800, 1800]);
  });

  it('failed sync falls back to valid duration context, retaining experience and the prior reference', () => {
    const input = paceInput();
    input.state = { ...existingControl(), lastDeliveredStrategy: 'evidence_pace' };
    input.objective.lastReadState = 'failed';
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      experience: { level: 'experienced' },
      bounds: { maxSessionSeconds: 1800, maxWeekSeconds: 5400 },
    });
  });

  it('beginner preference wins even when pace evidence exists, until explicit exit', () => {
    const input = paceInput();
    input.baselineInput.experience.level = 'beginner';
    expect(createPrescription(input).prescription.strategy).toBe('entry');
    input.entryPreference = { choice: 'use_current_routine', confirmedAt: AS_OF };
    expect(createPrescription(input).prescription.strategy).toBe('evidence_pace');
  });

  it('event exceptions exist only on the actual future available event day', () => {
    const input = paceInput();
    input.calendar.availableDays = [1, 3, 4, 5];
    const result = createPrescription(input);
    expect(result.prescription.attemptEligible).toBe(true);
    expect(result.frozen!.paceDates).toEqual([
      {
        date: '2026-10-19',
        maxSessionSeconds: 7080,
        maxSessionMeters: 19800,
        attemptEligible: false,
      },
      {
        date: '2026-10-21',
        maxSessionSeconds: 7080,
        maxSessionMeters: 19800,
        attemptEligible: false,
      },
      {
        date: '2026-10-22',
        maxSessionSeconds: 6600,
        maxSessionMeters: 23097.5,
        attemptEligible: true,
      },
      {
        date: '2026-10-23',
        maxSessionSeconds: 7080,
        maxSessionMeters: 19800,
        attemptEligible: false,
      },
    ]);
    expect(result.prescription.bounds!.maxWeekSeconds).toBe(27840);
    input.target.eventDate = '2026-10-16';
    expect(createPrescription(input).prescription.attemptEligible).toBe(false);
    input.target.eventDate = '2026-10-22';
    input.calendar.availableDays = [1, 3, 5];
    expect(createPrescription(input).prescription.attemptEligible).toBe(false);
    expect(createPrescription(input).prescription.sessions.map((s) => s.date)).toEqual([
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
    ]);
  });

  it('active and closing resume episodes intersect pace caps, preserve RPE3, and prohibit attempts', () => {
    const input = paceInput();
    input.calendar.availableDays = [1, 3, 4, 5];
    input.state = existingControl(1440, 4320);
    input.state.episode = {
      id: 'episode',
      state: 'active',
      lastRunBeforeBreak: '2026-09-01',
      observedThrough: '2026-09-25',
      openedFromRevision: 'old-continuity',
      anchor: existingControl().reference!,
      factor: 0.8,
      firstDeliveryId: 'first',
      firstDeliveryDate: '2026-09-25',
      maxSessionsPerWeek: 3,
      maxSessionSeconds: 1440,
      maxWeekSeconds: 4320,
      closedByWeekIds: [],
    };
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'evidence_pace',
      attemptEligible: false,
      controlBounds: {
        maxSessionsPerWeek: 3,
        maxSessionSeconds: 1440,
        maxWeekSeconds: 4320,
        maxRpe: 3,
      },
    });
    expect(() => validateFinalWeek(result.frozen!, [workout([running()])])).toThrow('RPE_LIMIT');
    const rpe3 = running();
    rpe3.target = { paceSecPerKmMin: 360, paceSecPerKmMax: 370, rpe: 3 };
    const approved = validateFinalWeek(result.frozen!, [workout([rpe3])]);
    expect(approved[0].segments[0].cue).toContain('RPE <= 3');
    expect(approved[0].isGoalAttempt).toBe(false);
  });
});

describe('final executable structure validation and fallback', () => {
  it('duration templates reject changed units, seconds, modality, cues, targets and repetitions', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    const frozen = createPrescription(input).frozen!;
    const original = frozen.expectedTrees[0].segments;
    for (const mutate of [
      (s: Segment[]) => {
        s[0].end!.by = 'distanceM';
      },
      (s: Segment[]) => {
        s[0].end!.value = 300;
      },
      (s: Segment[]) => {
        s[0].label = 'Correr forte';
      },
      (s: Segment[]) => {
        s[0].cue = 'Run the goal now';
      },
      (s: Segment[]) => {
        s[0].target = { rpe: 8 };
      },
      (s: Segment[]) => {
        s[1].repetitions = 7;
      },
      (s: Segment[]) => {
        s[0].target = { rpe: 3, paceSecPerKmMin: 360, paceSecPerKmMax: 370 };
      },
    ]) {
      const segments = structuredClone(original);
      mutate(segments);
      expect(() => validateFinalWeek(frozen, [workout(segments)])).toThrow(
        'DURATION_TEMPLATE_CHANGED',
      );
    }
    expect(() =>
      validateFinalWeek(frozen, [{ ...workout(original), isGoalAttempt: true }]),
    ).toThrow('ATTEMPT_FORBIDDEN');
    const fallback = validatedFallback(frozen);
    expect(fallback.map((w) => w.maximumSeconds)).toEqual([1200, 1200, 1200]);
    expect(
      fallback.every(
        (w) => w.maximumRunMeters === null && !w.description.includes('Run the goal now'),
      ),
    ).toBe(true);
  });

  it('pace requires both finite numeric range endpoints and rejects unknown leaf units and target types', () => {
    const frozen = createPrescription(paceInput()).frozen!;
    const noMax = running();
    noMax.target = { paceSecPerKmMin: 360, rpe: 4 };
    expect(() => validateFinalWeek(frozen, [workout([noMax])])).toThrow('PACE_RANGE_REQUIRED');
    const hrOnly = running();
    hrOnly.target = { hrZone: 2, rpe: 4 };
    expect(() => validateFinalWeek(frozen, [workout([hrOnly])])).toThrow('PACE_RANGE_REQUIRED');
    const nan = running();
    nan.target = { paceSecPerKmMin: NaN, paceSecPerKmMax: 370 };
    expect(() => validateFinalWeek(frozen, [workout([nan])])).toThrow('INVALID_TARGET');
    const unknown = running();
    unknown.end!.by = 'reps';
    expect(() => validateFinalWeek(frozen, [workout([unknown])])).toThrow('INVALID_REQUEST');
    const cycle = running();
    cycle.target = { powerWattsMin: 100 };
    expect(() => validateFinalWeek(frozen, [workout([cycle])])).toThrow('INVALID_STRUCTURE');
  });

  it('expands sets up to 512 leaves, rejecting empty, cyclic, fractional or hidden structures', () => {
    const leaf = running();
    expect(
      expandSegments([{ id: 'set', kind: 'set', repetitions: 512, children: [leaf] }]),
    ).toHaveLength(512);
    expect(() =>
      expandSegments([{ id: 'set', kind: 'set', repetitions: 513, children: [leaf] }]),
    ).toThrow();
    expect(() =>
      expandSegments([{ id: 'set', kind: 'set', repetitions: 1.5, children: [leaf] }]),
    ).toThrow();
    expect(() =>
      expandSegments([{ id: 'set', kind: 'set', repetitions: 1, children: [] }]),
    ).toThrow('INVALID_STRUCTURE');
    const cyclic: Segment = { id: 'cycle', kind: 'set', repetitions: 1, children: [] };
    cyclic.children!.push(cyclic);
    expect(() => expandSegments([cyclic])).toThrow('INVALID_STRUCTURE');
    expect(() => expandSegments([{ ...leaf, children: [leaf] }])).toThrow('INVALID_STRUCTURE');
  });

  it('checks cumulative set geometry even with isGoalAttempt omitted', () => {
    const frozen = createPrescription(paceInput(false)).frozen!;
    const hidden: Segment = {
      id: 'set',
      kind: 'set',
      repetitions: 5,
      children: [{ ...running('rep', 1800, 420, 430), end: { by: 'distanceM', value: 5000 } }],
    };
    expect(() => validateFinalWeek(frozen, [workout([hidden])])).toThrow();
    const easier = running('easy', 600, 480, 500);
    expect(validatedFallback(frozen, [workout([easier])])).toHaveLength(1);
    expect(() => validatedFallback(frozen, [workout([hidden])])).toThrow();
  });

  it('rejects an unsupported goal distance even if sets, walking, or missing flags hide it', () => {
    const base = createPrescription(paceInput(false)).frozen!;
    const frozen = freezeWith(base, (f) => {
      f.target.distanceMeters = 1500;
      f.target.timeSeconds = null;
      f.assessment.endurance.state = 'insufficient_data';
    });
    const segments: Segment[] = [
      {
        id: 'set',
        kind: 'set',
        repetitions: 2,
        children: [
          { ...running('run', 450, 480, 500), end: { by: 'distanceM', value: 750 } },
          {
            id: 'walk',
            kind: 'recovery',
            label: 'Caminhar',
            end: { by: 'durationSec', value: 30 },
            target: { rpe: 3 },
          },
        ],
      },
    ];
    expect(() => validateFinalWeek(frozen, [workout(segments)])).toThrow(
      'UNSUPPORTED_GOAL_DISTANCE',
    );
  });

  it('rejects a D/T window inside a larger block despite omitted attempt flag', () => {
    const base = createPrescription(paceInput()).frozen!;
    const frozen = freezeWith(base, (f) => {
      f.target.distanceMeters = 1500;
      f.target.timeSeconds = 540;
      f.assessment.performance.state = 'insufficient_data';
      f.assessment.endurance.state = 'supported';
    });
    expect(() =>
      validateFinalWeek(frozen, [workout([running('larger-block', 1200, 360, 370)])]),
    ).toThrow('UNSUPPORTED_GOAL_TIME');
  });

  it('fastest-window computation includes partial blocks and actual recoveries', () => {
    expect(
      fastestRunningWindow(
        [
          { meters: 1000, fastestSeconds: 300 },
          { meters: 1000, fastestSeconds: 400 },
        ],
        1500,
      ),
    ).toBe(500);
    expect(
      fastestRunningWindow(
        [
          { meters: 1000, fastestSeconds: 300 },
          { meters: 0, fastestSeconds: 120 },
          { meters: 1000, fastestSeconds: 300 },
        ],
        1500,
      ),
    ).toBe(570);
    expect(
      fastestRunningWindow(
        [
          { meters: 0, fastestSeconds: 120 },
          { meters: 1000, fastestSeconds: 300 },
          { meters: 0, fastestSeconds: 120 },
        ],
        1000,
      ),
    ).toBe(300);
    expect(fastestRunningWindow([{ meters: 1000, fastestSeconds: 300 }], 1500)).toBeNull();
  });

  it('uses upper distance/time bounds rather than an average pace, after range widening', () => {
    const base = createPrescription(paceInput()).frozen!;
    const frozen = freezeWith(base, (f) => {
      f.paceDates[0].maxSessionMeters = 3350;
    });
    expect(
      validateFinalWeek(frozen, [workout([running('original', 1200, 360, 370)])])[0]
        .maximumRunMeters,
    ).toBeCloseTo(3333.333333, 5);
    expect(() =>
      validateFinalWeek(frozen, [workout([running('widened', 1200, 354, 376)])]),
    ).toThrow('SESSION_DISTANCE_LIMIT');
    const distanceFixed = {
      ...running('distance'),
      end: { by: 'distanceM' as const, value: 1000 },
    };
    expect(validateFinalWeek(base, [workout([distanceFixed])])[0].maximumSeconds).toBe(370);
  });

  it('continuous-index guard does not let fast recovery-running disappear from a continuous stretch', () => {
    const frozen = createPrescription(paceInput()).frozen!;
    const fast: Segment[] = [
      { ...running('one', 300, 210, 220), end: { by: 'distanceM', value: 3000 } },
      {
        ...running('recovery', 300, 360, 370),
        kind: 'recovery',
        end: { by: 'distanceM', value: 1000 },
      },
      { ...running('two', 300, 210, 220), end: { by: 'distanceM', value: 3000 } },
    ];
    expect(() => validateFinalWeek(frozen, [workout(fast)])).toThrow('CONTINUOUS_INDEX_EXCEEDED');
  });

  it('week/session/date/attempt limits apply identically to supplied fallback and final structure', () => {
    const frozen = createPrescription(paceInput()).frozen!;
    expect(() => validateFinalWeek(frozen, [workout([running()], '2026-10-20')])).toThrow(
      'DATE_NOT_AUTHORIZED',
    );
    expect(() =>
      validateFinalWeek(frozen, [workout([running()]), workout([running('again')])]),
    ).toThrow('DUPLICATE_DATE');
    expect(() =>
      validateFinalWeek(frozen, [{ ...workout([running()]), isGoalAttempt: true }]),
    ).toThrow('ATTEMPT_FORBIDDEN');
    expect(() =>
      validatedFallback(frozen, [workout([running('too-long', 7081, 480, 500)])]),
    ).toThrow('SESSION_TIME_LIMIT');
    const lowWeek = freezeWith(frozen, (f) => {
      f.prescription.bounds!.maxWeekSeconds = 1000;
    });
    expect(() =>
      validateFinalWeek(lowWeek, [workout([running()]), workout([running()], '2026-10-21')]),
    ).toThrow('WEEK_TIME_LIMIT');
  });

  it('replaces model text with deterministic descriptions and rejects frozen snapshot mutation', () => {
    const frozen = createPrescription(paceInput()).frozen!;
    const candidate = workout([running()]);
    const before = structuredClone(candidate);
    const approved = validateFinalWeek(frozen, [candidate]);
    expect(approved[0].title).toBe('Corrida');
    expect(approved[0].description).toBe('Correr leve: 600 s; RPE <= 4; Pace 360-370 s/km');
    expect(approved[0].segments[0].cue).toBe('RPE <= 4; Pace 360-370 s/km');
    expect(candidate).toEqual(before);
    const tampered = structuredClone(frozen);
    tampered.prescription.bounds!.maxWeekSeconds++;
    expect(() => validateFinalWeek(tampered, [candidate])).toThrow('SNAPSHOT_CHANGED');
  });

  it('validates the permitted 512-leaf boundary with complete continuous geometry', () => {
    const frozen = createPrescription(paceInput()).frozen!;
    const segment: Segment = {
      id: 'set-512',
      kind: 'set',
      repetitions: 512,
      children: [running('leaf', 12, 360, 370)],
    };
    const approved = validateFinalWeek(frozen, [workout([segment])]);
    expect(approved[0].maximumSeconds).toBe(6144);
    expect(approved[0].maximumRunMeters).toBeCloseTo(17066.666667, 5);
  });
});
