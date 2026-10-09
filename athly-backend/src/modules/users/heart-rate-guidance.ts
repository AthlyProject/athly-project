import type { HealthRunItemDto } from '../ai-planner/dto/plan-from-health.dto';
import { HEART_RATE_MAX_AGE_MS, HeartRateZones } from './heart-rate-zones';

export interface TrainingGuidance {
  mode: 'rpe' | 'heart_rate_and_rpe';
  reason: 'no_recent_heart_rate' | 'missing_zone_inputs' | 'available';
  lastHeartRateRunAt: string | null;
}

export type GuidedHeartRateZones = HeartRateZones & { trainingGuidance: TrainingGuidance };

export function measuredHeartRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 240;
}

/** Whole runs only. UUID and exact start time identify duplicates across ingestion paths. */
export function mergeHeartRateRuns(...sources: unknown[][]): HealthRunItemDto[] {
  const runs: HealthRunItemDto[] = [];
  for (const value of sources.flat()) {
    if (!value || typeof value !== 'object') continue;
    const run = value as HealthRunItemDto;
    const timestamp = new Date(run.startDate).getTime();
    if (
      !Number.isFinite(timestamp) ||
      timestamp > Date.now() ||
      !Number.isFinite(run.durationSeconds) ||
      run.durationSeconds <= 0 ||
      !Number.isFinite(run.distanceMeters) ||
      run.distanceMeters < 0
    )
      continue;
    const id =
      typeof run.appleHealthWorkoutUUID === 'string'
        ? run.appleHealthWorkoutUUID.toLowerCase()
        : undefined;
    const index = runs.findIndex(
      (r) => (id && r.appleHealthWorkoutUUID === id) || +new Date(r.startDate) === timestamp,
    );
    const previous = index < 0 ? undefined : runs[index];
    const merged: HealthRunItemDto = {
      ...previous,
      startDate: new Date(timestamp).toISOString(),
      appleHealthWorkoutUUID: id ?? previous?.appleHealthWorkoutUUID,
      distanceMeters: run.distanceMeters,
      durationSeconds: run.durationSeconds,
      averagePaceSecondsPerKm: run.averagePaceSecondsPerKm ?? previous?.averagePaceSecondsPerKm,
      elevationGainMeters: run.elevationGainMeters ?? previous?.elevationGainMeters,
      activeEnergyBurned: run.activeEnergyBurned ?? previous?.activeEnergyBurned,
      avgHR: measuredHeartRate(run.avgHR) ? run.avgHR : previous?.avgHR,
      maxHR: measuredHeartRate(run.maxHR) ? run.maxHR : previous?.maxHR,
    };
    if (index < 0) runs.push(merged);
    else runs[index] = merged;
  }
  return runs.sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
}

export function withTrainingGuidance(
  zones: HeartRateZones,
  runs: HealthRunItemDto[],
  now = new Date(),
): GuidedHeartRateZones {
  const measured = runs.filter(
    (r) => measuredHeartRate(r.avgHR) && r.durationSeconds > 0 && +new Date(r.startDate) <= +now,
  );
  const latest = measured.reduce<number | null>(
    (last, r) => Math.max(last ?? 0, +new Date(r.startDate)),
    null,
  );
  const reason =
    latest === null || latest < +now - HEART_RATE_MAX_AGE_MS
      ? 'no_recent_heart_rate'
      : zones.status !== 'available'
        ? 'missing_zone_inputs'
        : 'available';
  return {
    ...zones,
    trainingGuidance: {
      mode: reason === 'available' ? 'heart_rate_and_rpe' : 'rpe',
      reason,
      lastHeartRateRunAt: latest === null ? null : new Date(latest).toISOString(),
    },
  };
}

export function weightedHeartRate(runs: HealthRunItemDto[]): number | null {
  const measured = mergeHeartRateRuns(runs).filter((r) => measuredHeartRate(r.avgHR));
  const duration = measured.reduce((sum, r) => sum + r.durationSeconds, 0);
  return duration > 0
    ? Math.round(measured.reduce((sum, r) => sum + r.avgHR! * r.durationSeconds, 0) / duration)
    : null;
}
