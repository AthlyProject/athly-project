import { GeminiService } from './gemini.service';
import { calculateHeartRateZones } from '../users/heart-rate-zones';
import { withTrainingGuidance } from '../users/heart-rate-guidance';
import {
  assessHeartRatePrescription,
  snapshotHeartRateTargets,
  heartRatePrescriptionPrompt,
} from './heart-rate-prescription';
import { flattenToLegacyBlocks } from '../workouts/utils/flatten-to-legacy';
import type { WorkoutDay } from './types/planner.types';

const enabled = (estimated = false) =>
  withTrainingGuidance(
    calculateHeartRateZones({
      restingHeartRate: 60,
      maxHeartRate: estimated ? null : 190,
      dateOfBirth: new Date('1990-01-01'),
    }),
    [
      {
        startDate: new Date(Date.now() - 86400000).toISOString(),
        distanceMeters: 5000,
        durationSeconds: 1800,
        avgHR: 145,
      },
    ],
  );

const day = (): WorkoutDay => ({
  date: '2026-10-01',
  dayOfWeek: 'Thursday',
  title: 'Corrida fácil',
  description: 'Ritmo confortável.',
  reasoning: 'Construir base.',
  sportType: 'running',
  intensity: 4,
  segments: ['warmup', 'work', 'cooldown'].map((kind, i) => ({
    id: `s${i}`,
    kind: kind as 'work',
    end: { by: 'durationSec', value: 600 },
    target: { rpe: 4, hrZone: 2, paceSecPerKmMin: 360 },
  })),
});

describe('New workout HR prescriptions', () => {
  it('requires RPE on nested active segments and forbids HR in RPE-only prescriptions', () => {
    const workout = day();
    workout.segments = [{ id: 'set', kind: 'set', repetitions: 3, children: workout.segments }];
    expect(assessHeartRatePrescription([workout]).join(' ')).toContain('forbids HR');
    workout.segments[0].children![0].target = { hrZone: 2 };
    expect(assessHeartRatePrescription([workout], enabled()).join(' ')).toContain('target.rpe');
  });

  it.each([
    'Corra em Z2',
    'Zona 2',
    'Mantenha 140–150 bpm',
    '80% da FC máxima',
    'Heart rate zone 2',
  ])('rejects unstructured HR instructions: %s', (description) => {
    const workout = day();
    workout.segments.forEach((s) => {
      s.target = { rpe: 4 };
    });
    workout.description = description;
    expect(assessHeartRatePrescription([workout]).join(' ')).toContain('remove HR prescription');
  });

  it('overwrites hallucinated BPM with profile ranges, retaining pace and RPE in legacy blocks', () => {
    const workout = day();
    workout.segments[0].target = {
      rpe: 4,
      hrZone: 2,
      hrMinBpm: 1,
      hrMaxBpm: 999,
      hrIsEstimated: true,
    };
    snapshotHeartRateTargets([workout], enabled());
    expect(workout.segments[0].target).toEqual({
      rpe: 4,
      hrZone: 2,
      hrMinBpm: 138,
      hrMaxBpm: 150,
      hrIsEstimated: false,
    });
    const blocks = flattenToLegacyBlocks(workout.segments);
    expect(blocks[1].instructions).toContain('Z2 (138–150 bpm) · RPE 4/10');
    expect(blocks[1].targetPace).toBe('6:00/km');
  });

  it('marks age estimates explicitly and keeps the persisted snapshot when profile changes', () => {
    const workout = day();
    const zones = enabled(true);
    snapshotHeartRateTargets([workout], zones);
    const saved = JSON.stringify(workout);
    zones.zones[1].minBpm = 90;
    expect(JSON.stringify(workout)).toBe(saved);
    expect(workout.description).toContain('Apple Health não forneceu dados suficientes');
    expect(workout.segments[0].target).toMatchObject({ hrIsEstimated: true });
  });

  it.each(['normal', 'assessment'])(
    'uses correction/retry and backend ranges in the %s generator',
    async (kind) => {
      const gemini = new GeminiService({ get: () => 'test-key' } as any);
      const invalid = Array.from({ length: 7 }, day);
      invalid[0].segments[0].target = { rpe: 4 }; // Missing required zone triggers retry.
      const valid = Array.from({ length: 7 }, day);
      const usage = {
        model: 'test',
        inputTokens: 10,
        outputTokens: 10,
        thinkingTokens: 0,
        totalTokens: 20,
        estimatedCostUsd: null,
        pricing: {},
        attempts: 1,
        tokenSource: 'usageMetadata',
      };
      const mock = jest
        .fn()
        .mockResolvedValueOnce({
          usage,
          rawResponse: JSON.stringify({ analysis: {}, weekPlan: invalid }),
        })
        .mockResolvedValue({
          usage,
          rawResponse: JSON.stringify({ analysis: {}, weekPlan: valid }),
        });
      (gemini as any).generateJson = mock;
      const effort = { formatted: '', vdotScore: 40, heartRate: enabled() };
      const dates = ['2026-10-01'];
      const result =
        kind === 'assessment'
          ? await gemini.generateAssessmentPlan(dates, 3, ['thursday'], effort)
          : await gemini.generatePlan(
              {
                runSummaries: [],
                avgDistKm: 5,
                avgPace: '6:00',
                avgHR: 145,
                maxDistKm: 5,
                totalDistKm: 5,
                weekDates: dates,
                trainingDays: 3,
                availableDays: ['thursday'],
              },
              effort,
            );
      expect(mock).toHaveBeenCalledTimes(2);
      expect(mock.mock.calls[0][0]).toContain('heart_rate_and_rpe');
      expect(result.parsed.weekPlan[0].segments[0].target).toMatchObject({
        hrZone: 2,
        rpe: 4,
        hrMinBpm: 138,
        hrMaxBpm: 150,
      });
    },
  );

  it('defaults both prompts to explicit RPE when shared guidance is unavailable', () => {
    expect(heartRatePrescriptionPrompt()).toContain('NÃO gere target.hrZone');
  });
});
