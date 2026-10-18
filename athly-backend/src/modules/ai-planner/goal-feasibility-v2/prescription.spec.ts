import { createPrescription } from './prescription';
import {
  deriveDurationBaseline,
  experienceFromLegacy,
  historicalResumeAnchor,
  routineBaseline,
  sessionsBaseline,
} from './baseline';
import { normalizeDurationSessions, sessionWindowHash } from './sessions';
import { normalizeObjectiveEvidence } from './objective';
import { prescriptionDates } from './calendar';
import { durationTree, entryDoseSeconds, entryTree } from './trees';
import { validatedFallback } from './validation';
import {
  AS_OF,
  anchor,
  capture,
  declaration,
  deliveredWeek,
  existingControl,
  prescriptionInput,
  recordedRun,
  ROUTINE,
  sourceFact,
  USER,
  ZONE,
} from './test-fixtures';

describe('single prescription selector and canonical duration baselines', () => {
  it('prescribes experienced runner without sensors 3x1800, without certifying meters or changing the goal', () => {
    const input = prescriptionInput();
    const before = structuredClone(input);
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'duration_rpe',
      delivery: 'ready',
      goalSupport: 'insufficient_data',
      attemptEligible: false,
      guidance: 'rpe',
      bounds: {
        maxSessionSeconds: 1800,
        maxWeekSeconds: 5400,
        maxRunSecondsPerSession: 1440,
        maxSessionMeters: null,
        maxWeekMeters: null,
      },
    });
    expect(result.prescription.sessions.map((s) => [s.date, s.durationSeconds])).toEqual([
      ['2026-10-19', 1800],
      ['2026-10-21', 1800],
      ['2026-10-23', 1800],
    ]);
    expect(validatedFallback(result.frozen!).map((w) => w.maximumSeconds)).toEqual([
      1800, 1800, 1800,
    ]);
    expect(input).toEqual(before);
    expect(createPrescription(input)).toEqual(result);
  });

  it('unknown experience with sufficient routine uses the same duration dose', () => {
    const input = prescriptionInput();
    input.baselineInput.experience = { level: 'unknown', source: 'unknown', declaredAt: null };
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      experience: { level: 'unknown' },
      bounds: { maxWeekSeconds: 5400 },
    });
  });

  it('keeps beginners in entry until an explicit exit and does not reclassify experience', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'entry',
      bounds: { maxSessionSeconds: 1200, maxWeekSeconds: 3600, maxRunSecondsPerSession: 180 },
    });
    input.entryPreference = { choice: 'use_current_routine', confirmedAt: AS_OF };
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      experience: { level: 'beginner' },
      bounds: { maxSessionSeconds: 1800 },
    });
    input.entryPreference = { choice: 'entry', confirmedAt: AS_OF };
    expect(createPrescription(input).prescription.strategy).toBe('entry');
  });

  it('expired context after exit requires only missing context and never returns automatically to entry', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    input.entryPreference = { choice: 'use_current_routine', confirmedAt: AS_OF };
    input.baselineInput.routine = {
      ...ROUTINE,
      periodFrom: '2026-09-04',
      periodThrough: '2026-09-17',
    };
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'context_required',
      delivery: 'context_required',
      bounds: null,
    });
    expect(result.prescription.missingFields).toContain('confirm_current_routine');
    expect(result.dosePlan).toBeNull();
    expect(result.frozen).toBeNull();
  });

  it.each(['no_history', 'beginner'] as const)(
    'explicit %s can enter without any routine baseline',
    (level) => {
      const input = prescriptionInput();
      input.baselineInput.experience.level = level;
      input.baselineInput.routine = null;
      input.baselineInput.continuity = null;
      expect(createPrescription(input).prescription).toMatchObject({
        strategy: 'entry',
        bounds: { maxSessionSeconds: 1200 },
      });
    },
  );

  it('unknown without routine is context_required, while availability unknown and empty remain distinct', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'unknown';
    input.baselineInput.routine = null;
    input.baselineInput.continuity = null;
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'context_required',
      sessions: [],
    });
    input.calendar.availableDays = null;
    expect(createPrescription(input).prescription.missingFields).toEqual(['availability']);
    input.calendar.availableDays = [];
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'paused',
      delivery: 'no_sessions',
    });
    input.restrictions.preventsExercise = true;
    input.calendar.availableDays = null;
    expect(createPrescription(input).prescription.strategy).toBe('paused');
  });

  it('frequency zero does not create a positive baseline or imply beginner', () => {
    const input = prescriptionInput();
    input.baselineInput.routine!.weeklyRunDays = 0;
    const result = createPrescription(input).prescription;
    expect(result).toMatchObject({
      strategy: 'context_required',
      experience: { level: 'experienced' },
    });
    expect(result.missingFields).toContain('weekly_run_days');
    expect(() =>
      createPrescription({
        ...input,
        baselineInput: { ...input.baselineInput, routine: { ...ROUTINE, usualSessionSeconds: 0 } },
      }),
    ).toThrow('INVALID_REQUEST');
  });

  it('missing RPE/fatigue does not block maintenance and never qualifies for progression', () => {
    const input = prescriptionInput();
    input.state = existingControl();
    input.baselineInput.routine!.usualEffortRpe = null;
    input.baselineInput.routine!.currentFatigue = null;
    input.weeks = [deliveredWeek('2026-09-28', '2026-10-04'), deliveredWeek()];
    input.weeks.forEach((w) =>
      w.opportunities.forEach((o) => {
        o.effortRpe = null;
        o.fatigue = null;
      }),
    );
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      adjustment: 'maintain',
      bounds: { maxSessionSeconds: 1800 },
    });
  });

  it.each([
    [8, 1440, 4320],
    [6, 1620, 4860],
  ] as const)('recent fatigue %s applies the prescribed factor and RPE3', (fatigue, q, p) => {
    const input = prescriptionInput();
    input.baselineInput.routine!.currentFatigue = fatigue;
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      bounds: { maxSessionSeconds: q, maxWeekSeconds: p, maxRpe: 3 },
    });
    expect(result.frozen!.expectedTrees[0].segments[1]).toMatchObject({
      target: { rpe: 3 },
      cue: 'RPE <= 3; caminhe conforme precisar',
    });
  });

  it('two tolerated weeks progress to 1890/5670 but the 4860 actual cap produces 1680/5040 reduction', () => {
    const input = prescriptionInput();
    input.state = existingControl();
    input.weeks = [deliveredWeek('2026-09-28', '2026-10-04'), deliveredWeek()];
    expect(createPrescription(input).prescription).toMatchObject({
      adjustment: 'progress',
      bounds: { maxSessionSeconds: 1890, maxWeekSeconds: 5670, maxRunSecondsPerSession: 1530 },
    });
    input.weeks.forEach((w) => w.opportunities.forEach((o) => (o.actualSeconds = 1620)));
    expect(createPrescription(input).prescription).toMatchObject({
      adjustment: 'reduce',
      bounds: { maxSessionSeconds: 1680, maxWeekSeconds: 5040 },
    });
  });

  it('partial week emits 3600 while preserving nominal 5400 and four explicit days redistribute 1350', () => {
    const input = prescriptionInput();
    input.state = existingControl();
    input.calendar.availableDays = [1, 5];
    const partial = createPrescription(input).prescription;
    expect(partial.sessions.map((s) => s.durationSeconds)).toEqual([1800, 1800]);
    expect(partial.reference!.nominalWeekSeconds).toBe(5400);
    expect(partial.adjustment).toBe('maintain');
    input.calendar.availableDays = [1, 2, 4, 5];
    input.baselineInput.routine!.weeklyRunDays = 4;
    const redistributed = createPrescription(input).prescription;
    expect(redistributed.sessions.map((s) => s.durationSeconds)).toEqual([1350, 1350, 1350, 1350]);
    expect(redistributed.reference!.nominalWeekSeconds).toBe(5400);
  });

  it('duration absolute and additional caps produce the normative extreme and 810-second sessions', () => {
    const input = prescriptionInput();
    input.calendar.availableDays = [1, 2, 3, 4, 5, 6, 7];
    input.baselineInput.routine!.weeklyRunDays = 7;
    input.baselineInput.routine!.usualSessionSeconds = 20000;
    const extreme = createPrescription(input).prescription;
    expect(extreme.sessions.map((s) => [s.date, s.durationSeconds])).toEqual([
      ['2026-10-19', 3600],
      ['2026-10-20', 3600],
      ['2026-10-22', 3600],
      ['2026-10-23', 3600],
      ['2026-10-25', 3600],
    ]);
    expect(extreme.bounds!.maxWeekSeconds).toBe(18000);
    const limited = prescriptionInput();
    limited.restrictions.maxSessionSeconds = 1000;
    limited.restrictions.maxWeekSeconds = 2500;
    expect(createPrescription(limited).prescription).toMatchObject({
      bounds: { maxSessionSeconds: 810, maxWeekSeconds: 2430 },
    });
  });

  it.each([
    [299, 270, 'ready'],
    [20, 0, 'no_sessions'],
    [300, 300, 'ready'],
  ] as const)('quantizes %ss without rounding up', (q, expected, delivery) => {
    const input = prescriptionInput();
    input.state = existingControl(q, 3 * q);
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      strategy: 'duration_rpe',
      delivery,
      bounds: { maxSessionSeconds: expected },
    });
    if (expected < 300)
      expect(
        result.frozen!.expectedTrees.every(
          (s) => s.segments.length === 1 && s.segments[0].label === 'Caminhar',
        ),
      ).toBe(true);
  });

  it.each([
    [600, 1500, 660, 600, 30],
    [100, 200, 110, 110, 0],
    [601, 1500, 661, 600, 30],
  ] as const)('entry H=%ss preserves C and Q(C)', (H, meters, C, q, runSeconds) => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: capture([recordedRun(1, '2026-10-15', meters, H)], AS_OF),
      lastReadState: 'complete',
    });
    input.objectiveSourceId = 'objective:1';
    input.sourceFacts.push({ ...sourceFact('objective:1'), expiresAt: '2026-10-23T12:00:00Z' });
    const result = createPrescription(input);
    expect(result.frozen!.entryCeilingSeconds).toBe(C);
    expect(result.prescription).toMatchObject({
      strategy: 'entry',
      bounds: { maxSessionSeconds: q, maxRunSecondsPerSession: runSeconds },
    });
  });

  it('entry H601 with moderate fatigue yields 594-second walking, not 540', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    input.baselineInput.routine!.currentFatigue = 6;
    input.objective = normalizeObjectiveEvidence({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      capture: capture([recordedRun(1, '2026-10-15', 1500, 601)], AS_OF),
      lastReadState: 'complete',
    });
    input.objectiveSourceId = 'objective:1';
    input.sourceFacts.push({ ...sourceFact('objective:1'), expiresAt: '2026-10-23T12:00:00Z' });
    const result = createPrescription(input);
    expect(result.frozen!.entryCeilingSeconds).toBe(594);
    expect(result.prescription.sessions.map((s) => s.durationSeconds)).toEqual([594, 594, 594]);
    expect(result.frozen!.expectedTrees[0].segments).toEqual([
      {
        id: 'assessment-walk',
        kind: 'work',
        label: 'Caminhar',
        cue: 'RPE <= 3',
        end: { by: 'durationSec', value: 594 },
        target: { rpe: 3 },
      },
    ]);
  });

  it('entry fatigue8 freezes C960, runRpe3 and exactly four repetitions', () => {
    const input = prescriptionInput();
    input.baselineInput.experience.level = 'beginner';
    input.baselineInput.routine!.currentFatigue = 8;
    const result = createPrescription(input);
    expect(result.prescription).toMatchObject({
      bounds: {
        maxSessionSeconds: 960,
        maxWeekSeconds: 2880,
        maxRunSecondsPerSession: 120,
        maxRpe: 3,
      },
    });
    expect(result.frozen!.expectedTrees[0].segments[1]).toMatchObject({
      repetitions: 4,
      children: [{ target: { rpe: 3 } }, { target: { rpe: 3 } }],
    });
  });

  it('heart rate remains optional; canonical targets use zone1 for walking and reduced running', () => {
    const input = prescriptionInput();
    input.heartRateGuidanceAvailable = true;
    const regular = createPrescription(input);
    expect(regular.prescription).toMatchObject({
      guidance: 'heart_rate_and_rpe',
      bounds: { maxSessionSeconds: 1800 },
    });
    expect(regular.frozen!.expectedTrees[0].segments.map((s) => s.target)).toEqual([
      { rpe: 3, hrZone: 1 },
      { rpe: 4, hrZone: 2 },
      { rpe: 3, hrZone: 1 },
    ]);
    input.baselineInput.routine!.currentFatigue = 8;
    expect(createPrescription(input).frozen!.expectedTrees[0].segments[1].target).toEqual({
      rpe: 3,
      hrZone: 1,
    });
    input.baselineInput.experience.level = 'beginner';
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'entry',
      guidance: 'rpe',
    });
  });

  it('a conflict selects independent routine without progression, or requires resolution if none exists', () => {
    const input = prescriptionInput();
    input.baselineInput.conflicts = [{ memberIds: ['unrelated-conflicted-source'] }];
    input.state = existingControl();
    input.weeks = [deliveredWeek('2026-09-28', '2026-10-04'), deliveredWeek()];
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      adjustment: 'maintain',
      bounds: { maxSessionSeconds: 1800 },
    });
    input.baselineInput.routine = null;
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'context_required',
      missingFields: ['resolve_conflict'],
    });
  });

  it('a historical never-ran declaration is not retroactively contradicted by a later return', () => {
    const input = prescriptionInput();
    input.baselineInput.experience = {
      level: 'no_history',
      source: 'explicit_context',
      declaredAt: '2026-10-01T12:00:00Z',
    };
    input.baselineInput.objectivePracticeDates = ['2026-10-15'];
    expect(deriveDurationBaseline(input.baselineInput).hasConflict).toBe(false);
    input.baselineInput.objectivePracticeDates.push('2026-09-30');
    expect(deriveDurationBaseline(input.baselineInput).hasConflict).toBe(true);
  });

  it('routine validity is based on periodThrough inclusive 28 days, not confirmation time', () => {
    expect(
      routineBaseline(
        { ...ROUTINE, periodFrom: '2026-09-05', periodThrough: '2026-09-18' },
        AS_OF,
        ZONE,
      ),
    ).not.toBeNull();
    expect(
      routineBaseline(
        { ...ROUTINE, periodFrom: '2026-09-04', periodThrough: '2026-09-17' },
        AS_OF,
        ZONE,
      ),
    ).toBeNull();
    expect(routineBaseline({ ...ROUTINE, timeZone: 'UTC' }, AS_OF, ZONE)).toBeNull();
    expect(experienceFromLegacy('beginning', AS_OF).level).toBe('beginner');
    expect(experienceFromLegacy('pro', AS_OF).level).toBe('experienced');
    expect(experienceFromLegacy('inferred fast runner', AS_OF).level).toBe('unknown');
  });

  it('session inventory takes precedence, then routine, then lower-bound sessions; source totals never add', () => {
    const input = prescriptionInput();
    const reports = [
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
    ].map((date, i) => {
      const d = declaration(`session-${i}`, 900);
      d.value!.activityDate = date;
      return d;
    });
    const normalized = normalizeDurationSessions({
      userId: USER,
      asOf: AS_OF,
      timeZone: ZONE,
      declarations: reports,
      sources: [],
      relations: [],
      resolutions: [],
      barriers: [],
    });
    input.baselineInput.sessions = normalized.sessions;
    input.baselineInput.inventory = {
      userId: USER,
      id: 'inventory-1',
      revision: 1,
      timeZone: ZONE,
      periodFrom: '2026-09-28',
      periodThrough: '2026-10-11',
      confirmedAt: AS_OF,
      assertion: 'all_sessions_included',
      sessionSetHash: sessionWindowHash({
        userId: USER,
        timeZone: ZONE,
        periodFrom: '2026-09-28',
        periodThrough: '2026-10-11',
        sessions: normalized.sessions,
        relations: [],
      }),
    };
    expect(deriveDurationBaseline(input.baselineInput)).toMatchObject({
      source: 'complete_inventory',
      baseline: { sessionSeconds: 900, nominalWeekSeconds: 2700 },
    });
    input.baselineInput.inventory.sessionSetHash = 'stale';
    expect(deriveDurationBaseline(input.baselineInput)).toMatchObject({
      source: 'reported_routine',
      baseline: { sessionSeconds: 1800 },
    });
    input.baselineInput.routine = null;
    expect(deriveDurationBaseline(input.baselineInput)).toMatchObject({
      source: 'observed_lower_bound',
      baseline: { sessionSeconds: 900 },
    });
    expect(sessionsBaseline([], '2026-09-28', '2026-10-11')).toBeNull();
  });

  it('historical resume support must exist and be usable at the last run, without requiring current capture', () => {
    const oldRoutine = { ...ROUTINE, periodFrom: '2026-08-01', periodThrough: '2026-08-14' };
    const historical = { ...anchor(), basisIds: ['routine:routine-1:1'] };
    const input = {
      userId: USER,
      lastRunOn: '2026-08-17',
      timeZone: ZONE,
      routine: oldRoutine,
      reference: historical,
      existingSourceIds: ['routine:routine-1:1'],
      conflictingSourceIds: [],
    };
    expect(historicalResumeAnchor(input)).toEqual(historical);
    expect(historicalResumeAnchor({ ...input, existingSourceIds: [] })).toBeNull();
    expect(
      historicalResumeAnchor({ ...input, conflictingSourceIds: ['routine:routine-1:1'] }),
    ).toBeNull();
    expect(historicalResumeAnchor({ ...input, lastRunOn: '2026-09-12' })).toBeNull();
  });
});

describe('civil calendars and deterministic trees', () => {
  it('entry respects both week boundaries and chooses the earliest feasible largest subset', () => {
    const calendar = prescriptionInput().calendar;
    calendar.availableDays = [1, 2, 3, 4, 5, 6, 7];
    calendar.deliveredDates = ['2026-10-18'];
    expect(prescriptionDates(calendar, 'entry', 3)).toEqual([
      '2026-10-20',
      '2026-10-22',
      '2026-10-24',
    ]);
    calendar.deliveredDates = ['2026-10-18', '2026-10-26'];
    expect(prescriptionDates(calendar, 'entry', 3)).toEqual([
      '2026-10-20',
      '2026-10-22',
      '2026-10-24',
    ]);
  });

  it('duration allows at most two consecutive days and never compensates for past dates', () => {
    const calendar = prescriptionInput().calendar;
    calendar.availableDays = [1, 2, 3, 4, 5, 6, 7];
    calendar.deliveredDates = ['2026-10-17', '2026-10-18'];
    expect(prescriptionDates(calendar, 'duration_rpe', 3)).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-23',
    ]);
    calendar.asOf = '2026-10-23T12:00:00Z';
    expect(prescriptionDates(calendar, 'duration_rpe', 3)).toEqual(['2026-10-23', '2026-10-24']);
  });

  it('no eligible date pauses; a numerical zero keeps strategy with no_sessions', () => {
    const input = prescriptionInput();
    input.calendar.unavailableDates = ['2026-10-19', '2026-10-21', '2026-10-23'];
    expect(createPrescription(input).prescription.strategy).toBe('paused');
    input.calendar.unavailableDates = [];
    input.restrictions.maxSessionSeconds = 0;
    expect(createPrescription(input).prescription).toMatchObject({
      strategy: 'duration_rpe',
      delivery: 'no_sessions',
      sessions: [],
    });
  });

  it('canonical dose trees never contain zero-duration rest and keep modality/cues/targets explicit', () => {
    expect(entryDoseSeconds(661)).toBe(600);
    expect(entryDoseSeconds(594)).toBe(594);
    expect(entryTree(0, 4)).toEqual([]);
    expect(durationTree(0, 4)).toEqual([]);
    expect(durationTree(270, 4)).toEqual([
      {
        id: 'duration-walk',
        kind: 'work',
        label: 'Caminhar',
        cue: 'RPE <= 3',
        end: { by: 'durationSec', value: 270 },
        target: { rpe: 3 },
      },
    ]);
    expect(durationTree(300, 4).map((s) => s.end!.value)).toEqual([60, 180, 60]);
  });
});
