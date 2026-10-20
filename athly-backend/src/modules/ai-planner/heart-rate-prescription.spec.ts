import { GeminiService } from './gemini.service';
import { calculateHeartRateZones } from '../users/heart-rate-zones';
import { withTrainingGuidance } from '../users/heart-rate-guidance';
import {
  assessHeartRatePrescription,
  heartRateApplies,
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

  describe('tiros curtos e recuperações sem zona de FC', () => {
    const intervals = (): WorkoutDay => ({
      ...day(),
      segments: [
        {
          id: 'wu',
          kind: 'warmup',
          end: { by: 'durationSec', value: 600 },
          target: { rpe: 3, hrZone: 2 },
        },
        {
          id: 'set',
          kind: 'set',
          repetitions: 6,
          children: [
            // 400 m a ~4:54/km ≈ 2 min: curto.
            {
              id: 'rep',
              kind: 'work',
              end: { by: 'distanceM', value: 400 },
              target: { rpe: 9, hrZone: 5, paceSecPerKmMin: 284, paceSecPerKmMax: 304 },
            },
            {
              id: 'rec',
              kind: 'recovery',
              end: { by: 'durationSec', value: 90 },
              target: { rpe: 3, hrZone: 1 },
            },
          ],
        },
        // 2 km a ~5:20/km ≈ 10 min: longo.
        {
          id: 'tempo',
          kind: 'work',
          end: { by: 'distanceM', value: 2000 },
          target: { rpe: 7, hrZone: 4, paceSecPerKmMin: 310, paceSecPerKmMax: 330 },
        },
        {
          id: 'cd',
          kind: 'cooldown',
          end: { by: 'durationSec', value: 300 },
          target: { rpe: 2, hrZone: 1 },
        },
      ],
    });
    const target = (w: WorkoutDay, id: string) => {
      const all = [...w.segments, ...(w.segments[1].children ?? [])];
      return all.find((s) => s.id === id)!.target as Record<string, unknown>;
    };

    it('aceita tiro curto e recuperação sem hrZone, mas exige no trecho longo', () => {
      const w = intervals();
      delete target(w, 'rep').hrZone;
      delete target(w, 'rec').hrZone;
      expect(assessHeartRatePrescription([w], enabled())).toEqual([]);
      delete target(w, 'tempo').hrZone;
      expect(assessHeartRatePrescription([w], enabled()).join(' ')).toContain(
        'tempo: target.hrZone',
      );
    });

    it('remove a zona que a IA pôs em tiro curto e recuperação, mantendo pace e RPE', () => {
      const w = intervals();
      snapshotHeartRateTargets([w], enabled());
      expect(target(w, 'rep')).toEqual({ rpe: 9, paceSecPerKmMin: 284, paceSecPerKmMax: 304 });
      expect(target(w, 'rec')).toEqual({ rpe: 3 });
      expect(target(w, 'tempo')).toMatchObject({ hrZone: 4, hrMinBpm: expect.any(Number) });
      expect(target(w, 'wu')).toMatchObject({ hrZone: 2, hrMinBpm: 138 });
    });

    it('trecho por tempo: menos de 3 min é curto', () => {
      expect(
        heartRateApplies({ id: 'a', kind: 'work', end: { by: 'durationSec', value: 120 } }),
      ).toBe(false);
      expect(
        heartRateApplies({ id: 'b', kind: 'work', end: { by: 'durationSec', value: 300 } }),
      ).toBe(true);
      expect(
        heartRateApplies({ id: 'c', kind: 'work', end: { by: 'distanceM', value: 1000 } }),
      ).toBe(true);
      expect(
        heartRateApplies({ id: 'd', kind: 'work', end: { by: 'distanceM', value: 400 } }),
      ).toBe(false);
    });

    it('cita o trecho de prosa que disparou o defeito', () => {
      const w = day();
      w.description = 'Corra leve e mantenha a FC entre 140 e 150 bpm o tempo todo.';
      expect(assessHeartRatePrescription([w], enabled()).join(' ')).toContain('150 bpm');
    });
  });

  it('defaults both prompts to explicit RPE when shared guidance is unavailable', () => {
    expect(heartRatePrescriptionPrompt()).toContain('NÃO gere target.hrZone');
  });
});
