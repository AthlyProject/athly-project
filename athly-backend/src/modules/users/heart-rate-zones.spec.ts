import { calculateHeartRateZones, HEART_RATE_MAX_AGE_MS } from './heart-rate-zones';

describe('Profile heart rate zones', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  const health = { appleHealthRestingHeartRate: 60, appleHealthRestingHeartRateMeasuredAt: now };

  it('produces five disjoint inclusive integer intervals', () => {
    const result = calculateHeartRateZones({ restingHeartRate: 60, maxHeartRate: 190 }, now);
    expect(result).toMatchObject({
      status: 'available',
      method: 'hrr_v1',
      isEstimated: false,
      missingData: [],
    });
    expect(result.zones).toEqual([
      { zone: 1, minBpm: 125, maxBpm: 137 },
      { zone: 2, minBpm: 138, maxBpm: 150 },
      { zone: 3, minBpm: 151, maxBpm: 163 },
      { zone: 4, minBpm: 164, maxBpm: 176 },
      { zone: 5, minBpm: 177, maxBpm: 190 },
    ]);
  });

  it('preserves manual priority and uses automatic values again after null', () => {
    const input = {
      ...health,
      restingHeartRate: 65,
      maxHeartRate: 195,
      dateOfBirth: new Date('1996-09-30'),
    };
    expect(calculateHeartRateZones(input, now)).toMatchObject({
      restingHeartRate: { bpm: 65, source: 'manual' },
      maxHeartRate: { bpm: 195, source: 'manual' },
      isEstimated: false,
    });
    expect(
      calculateHeartRateZones({ ...input, restingHeartRate: null, maxHeartRate: null }, now),
    ).toMatchObject({
      restingHeartRate: { bpm: 60, source: 'apple_health', measuredAt: now.toISOString() },
      maxHeartRate: { bpm: 187, source: 'age_estimate' },
      isEstimated: true,
    });
  });

  it.each([
    ['1996-10-01', 188],
    ['1996-09-30', 187],
    ['2008-09-30', 195],
  ])('uses completed calendar years for birth %s', (birth, bpm) => {
    expect(
      calculateHeartRateZones({ ...health, dateOfBirth: new Date(birth) }, now).maxHeartRate?.bpm,
    ).toBe(bpm);
  });

  it.each([null, new Date('2008-10-01'), new Date('2027-01-01'), new Date('invalid')])(
    'requires a manual maximum without an eligible adult birth date: %s',
    (dateOfBirth) => {
      const result = calculateHeartRateZones({ ...health, dateOfBirth }, now);
      expect(result.missingData).toEqual(['max_heart_rate']);
      expect(result.zones).toEqual([]);
    },
  );

  it('expires HealthKit samples after 30 days but does not expire manual values', () => {
    const input = {
      ...health,
      maxHeartRate: 190,
      appleHealthRestingHeartRateMeasuredAt: new Date(+now - HEART_RATE_MAX_AGE_MS),
    };
    expect(calculateHeartRateZones(input, now).status).toBe('available');
    expect(calculateHeartRateZones(input, new Date(+now + 1)).missingData).toEqual([
      'resting_heart_rate',
    ]);
    expect(
      calculateHeartRateZones({ ...input, restingHeartRate: 60 }, new Date(+now + 1)).status,
    ).toBe('available');
  });

  it.each([
    [150, 140],
    [149, 150],
    [100, 100],
  ])('rejects invalid or collapsed intervals %s/%s', (restingHeartRate, maxHeartRate) => {
    const result = calculateHeartRateZones({ restingHeartRate, maxHeartRate }, now);
    expect(result.missingData).toEqual(['invalid_heart_rate_range']);
    expect(result.zones).toEqual([]);
  });

  it('does not replace corrupt manual data with silently estimated values', () => {
    const result = calculateHeartRateZones(
      { ...health, restingHeartRate: NaN, maxHeartRate: 0, dateOfBirth: new Date('1990-01-01') },
      now,
    );
    expect(result.missingData).toEqual(['resting_heart_rate', 'max_heart_rate']);
  });

  it('keeps rounded intervals contiguous across the supported HR range', () => {
    for (let restingHeartRate = 20; restingHeartRate <= 150; restingHeartRate++) {
      for (
        let maxHeartRate = Math.max(100, restingHeartRate + 10);
        maxHeartRate <= 240;
        maxHeartRate++
      ) {
        const { zones } = calculateHeartRateZones({ restingHeartRate, maxHeartRate }, now);
        expect(zones).toHaveLength(5);
        zones.forEach((zone, i) => {
          expect(zone.minBpm).toBeLessThanOrEqual(zone.maxBpm);
          if (i) expect(zone.minBpm).toBe(zones[i - 1].maxBpm + 1);
        });
        expect(zones[4].maxBpm).toBe(maxHeartRate);
      }
    }
  });
});
