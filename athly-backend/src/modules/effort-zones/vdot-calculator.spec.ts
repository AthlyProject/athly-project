import { calculateVdot, predictRaceTime } from './vdot-calculator';

describe('predictRaceTime — Daniels equivalent performance (inverse of calculateVdot)', () => {
  it('round-trips: predicting a time then recomputing VDOT returns the same VDOT', () => {
    for (const vdot of [30, 40, 50, 60, 70]) {
      for (const distanceMeters of [3000, 5000, 10000, 21097.5]) {
        const t = predictRaceTime(vdot, distanceMeters);
        // Rounding the predicted time to whole seconds shifts VDOT by up to ~0.06
        // at high VDOT / long distance, so allow a 0.1 tolerance on the round-trip.
        expect(Math.abs(calculateVdot(distanceMeters, t) - vdot)).toBeLessThan(0.1);
      }
    }
  });

  it('matches published Daniels VDOT table values (within a few seconds)', () => {
    // VDOT 50 → 5K 19:57 (1197s), 10K 41:21 (2481s)
    expect(predictRaceTime(50, 5000)).toBeGreaterThan(1197 - 8);
    expect(predictRaceTime(50, 5000)).toBeLessThan(1197 + 8);
    expect(predictRaceTime(50, 10000)).toBeGreaterThan(2481 - 10);
    expect(predictRaceTime(50, 10000)).toBeLessThan(2481 + 10);
    // VDOT 60 → 5K 17:03 (1023s)
    expect(predictRaceTime(60, 5000)).toBeGreaterThan(1023 - 8);
    expect(predictRaceTime(60, 5000)).toBeLessThan(1023 + 8);
  });

  it('a higher VDOT predicts a faster (smaller) time at the same distance', () => {
    expect(predictRaceTime(55, 5000)).toBeLessThan(predictRaceTime(45, 5000));
  });

  it('returns 0 for degenerate inputs', () => {
    expect(predictRaceTime(0, 5000)).toBe(0);
    expect(predictRaceTime(50, 0)).toBe(0);
  });
});
