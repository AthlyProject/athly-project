/** Profile HR reserve zones; deliberately independent of the planner's pace categories. */
export const HEART_RATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface HeartRateInputs {
  restingHeartRate?: number | null;
  maxHeartRate?: number | null;
  dateOfBirth?: Date | null;
  appleHealthRestingHeartRate?: number | null;
  appleHealthRestingHeartRateMeasuredAt?: Date | null;
}

export interface HeartRateValue {
  bpm: number;
  source: 'manual' | 'apple_health' | 'age_estimate';
  measuredAt: string | null;
}

export interface HeartRateZones {
  status: 'available' | 'insufficient_data';
  method: 'hrr_v1';
  isEstimated: boolean;
  missingData: Array<'resting_heart_rate' | 'max_heart_rate' | 'invalid_heart_rate_range'>;
  restingHeartRate: HeartRateValue | null;
  maxHeartRate: HeartRateValue | null;
  zones: Array<{ zone: number; minBpm: number; maxBpm: number }>;
}

export function validHeartRate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function calculateHeartRateZones(input: HeartRateInputs, now = new Date()): HeartRateZones {
  let resting: HeartRateValue | null = null;
  let maximum: HeartRateValue | null = null;
  if (validHeartRate(input.restingHeartRate, 20, 150)) {
    resting = { bpm: input.restingHeartRate, source: 'manual', measuredAt: null };
  } else if (input.restingHeartRate == null) {
    const measuredAt = input.appleHealthRestingHeartRateMeasuredAt;
    if (
      measuredAt &&
      +measuredAt <= +now &&
      +measuredAt >= +now - HEART_RATE_MAX_AGE_MS &&
      validHeartRate(input.appleHealthRestingHeartRate, 20, 150)
    ) {
      resting = {
        bpm: input.appleHealthRestingHeartRate,
        source: 'apple_health',
        measuredAt: measuredAt.toISOString(),
      };
    }
  }
  if (validHeartRate(input.maxHeartRate, 100, 240)) {
    maximum = { bpm: input.maxHeartRate, source: 'manual', measuredAt: null };
  } else if (input.maxHeartRate == null && input.dateOfBirth && +input.dateOfBirth <= +now) {
    const birth = input.dateOfBirth;
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    if (
      now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())
    )
      age--;
    const bpm = Math.round(208 - 0.7 * age);
    if (age >= 18 && validHeartRate(bpm, 100, 240)) {
      maximum = { bpm, source: 'age_estimate', measuredAt: null };
    }
  }

  const result: HeartRateZones = {
    status: 'insufficient_data',
    method: 'hrr_v1',
    isEstimated: maximum?.source === 'age_estimate',
    missingData: [],
    restingHeartRate: resting,
    maxHeartRate: maximum,
    zones: [],
  };
  if (!resting) result.missingData.push('resting_heart_rate');
  if (!maximum) result.missingData.push('max_heart_rate');
  if (!resting || !maximum) return result;

  const reserve = maximum.bpm - resting.bpm;
  const boundaries = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((p) => Math.round(resting.bpm + p * reserve));
  if (reserve <= 0 || boundaries.some((value, i) => i > 0 && value <= boundaries[i - 1])) {
    result.missingData.push('invalid_heart_rate_range');
    return result;
  }
  result.status = 'available';
  result.zones = boundaries.slice(0, 5).map((minBpm, i) => ({
    zone: i + 1,
    minBpm,
    maxBpm: boundaries[i + 1] - (i === 4 ? 0 : 1),
  }));
  return result;
}
