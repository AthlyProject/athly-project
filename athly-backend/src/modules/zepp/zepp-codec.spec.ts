import {
  digest,
  seal,
  unseal,
  validateDownloadUrl,
  parseEvents,
  zeppSteps,
  fitSummary,
} from './zepp-codec';
describe('Zepp boundary contracts', () => {
  const key = Buffer.alloc(32, 4).toString('base64');
  it('encrypts with authenticated randomized ciphertext', () => {
    const a = seal('secret', key);
    expect(a).not.toEqual(seal('secret', key));
    expect(unseal(a, key)).toBe('secret');
    const b = Buffer.from(a, 'base64');
    b[14] ^= 1;
    expect(() => unseal(b.toString('base64'), key)).toThrow();
    expect(digest('state')).toHaveLength(64);
  });
  it.each([
    'http://api-open.zepp.com/api/activity/file',
    'https://evil.test/api/activity/file',
    'https://api-open.zepp.com.evil.test/api/activity/file',
    'https://x@api-open.zepp.com/api/activity/file',
    'https://api-open.zepp.com:444/api/activity/file',
  ])('rejects unsafe URL %s', (u) => expect(() => validateDownloadUrl(u)).toThrow());
  it('preserves the exact signed download URL', () => {
    const u = 'https://api-open.zepp.com/api/activity/file?id=1&token=x';
    expect(validateDownloadUrl(u)).toBe(u);
  });
  it('parses double encoded webhook payloads', () => {
    expect(parseEvents(JSON.stringify([JSON.stringify({ activityFiles: [] })]))).toEqual([
      { activityFiles: [] },
    ]);
    expect(() => parseEvents('{}')).toThrow();
  });
  it('preserves repetitions and pace boundaries', () => {
    const step = {
      duration: { type: 'distance' as const, value: 400 },
      target: { type: 'pace' as const, fastSecPerKm: 240, slowSecPerKm: 260 },
    };
    const result = zeppSteps({
      name: 'Intervals',
      rev: '1',
      steps: [step, { repeatFrom: 0, times: 6 }],
    });
    expect(result[0]).toMatchObject({
      repeatValue: 6,
      steps: [{ durationValue: 400, targetValueLow: 240, targetValueHigh: 260 }],
    });
  });
  it('does not silently change unsupported steps', () =>
    expect(() =>
      zeppSteps({ name: 'Open', rev: '1', steps: [{ duration: { type: 'open' }, target: null }] }),
    ).toThrow('incompatível'));
  it('rejects corrupt FIT', () => expect(() => fitSummary(new Uint8Array([1, 2, 3]))).toThrow());
});

describe('Zepp workout groups', () => {
  const step = {
    duration: { type: 'time' as const, value: 60 },
    target: { type: 'pace' as const, fastSecPerKm: 300, slowSecPerKm: 330 },
  };
  it('handles consecutive repeats using original plan indices', () => {
    const result = zeppSteps({
      name: '',
      rev: '',
      steps: [step, step, { repeatFrom: 0, times: 3 }, step, { repeatFrom: 3, times: 2 }],
    });
    expect(result.map((s) => s.repeatValue)).toEqual([3, 2]);
    expect(result[0].steps).toHaveLength(2);
    expect(result[1].steps).toHaveLength(1);
  });
  it('preserves nested repeats', () => {
    const result = zeppSteps({
      name: '',
      rev: '',
      steps: [step, { repeatFrom: 0, times: 2 }, { repeatFrom: 0, times: 3 }],
    });
    expect(result[0].repeatValue).toBe(3);
    expect(result[0].steps[0].repeatValue).toBe(2);
  });
  it('uses explicit athlete HR boundaries', () => {
    const plan = {
      name: '',
      rev: '',
      steps: [{ ...step, target: { type: 'hr' as const, zone: 2 } }],
    };
    expect(zeppSteps(plan, { zone2: { min: 130, max: 145 } })[0]).toMatchObject({
      targetType: 'HEART_RATE_LAP',
      targetValueLow: 130,
      targetValueHigh: 145,
    });
    expect(() => zeppSteps(plan)).toThrow('zona de FC');
  });
  it.each([
    { minBpm: 138 },
    { maxBpm: 150 },
    { minBpm: 151, maxBpm: 138 },
    { minBpm: NaN, maxBpm: 150 },
    { minBpm: 138, maxBpm: Infinity },
    { minBpm: 0, maxBpm: 150 },
  ])(
    'rejects an invalid snapshot instead of replacing the prescription with profile zones: %s',
    (bounds) => {
      expect(() =>
        zeppSteps(
          { name: '', rev: '', steps: [{ ...step, target: { type: 'hr', zone: 2, ...bounds } }] },
          { zone2: { min: 130, max: 145 } },
        ),
      ).toThrow('zona de FC');
    },
  );
});

import { Encoder, Profile } from '@garmin/fitsdk';
it('reads a valid native running FIT without changing its samples', () => {
  const encoder = new Encoder();
  const start = new Date('2026-11-15T10:00:00Z');
  const end = new Date('2026-11-15T10:01:00Z');
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    timeCreated: start,
  });
  encoder.onMesg(Profile.MesgNum.RECORD, { timestamp: start, heartRate: 150 });
  encoder.onMesg(Profile.MesgNum.SESSION, {
    sport: 'running',
    startTime: start,
    timestamp: end,
    totalTimerTime: 60,
    totalDistance: 200,
    avgHeartRate: 150,
  });
  const bytes = encoder.close();
  const copy = Uint8Array.from(bytes);
  expect(fitSummary(bytes)).toMatchObject({
    distanceMeters: 200,
    timerSeconds: 60,
    avgHeartRate: 150,
  });
  expect(bytes).toEqual(copy);
});
