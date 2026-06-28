/**
 * Jack Daniels VDOT Calculator
 * Pure math functions - no framework dependencies
 *
 * Based on the Daniels & Gilbert oxygen cost formulas:
 * VO2 = -4.60 + 0.182258 * v + 0.000104 * v^2
 * %VO2max = 0.8 + 0.1894393 * e^(-0.012778 * t) + 0.2989558 * e^(-0.1932605 * t)
 * VDOT = VO2 / %VO2max
 */

export function calculateVdot(distanceMeters: number, durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60;
  const velocityMetersPerMin = distanceMeters / durationMinutes;

  // Oxygen cost of running at this velocity
  const vo2 = -4.60 + 0.182258 * velocityMetersPerMin + 0.000104 * Math.pow(velocityMetersPerMin, 2);

  // Percent of VO2max sustained for this duration
  const pctVo2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * durationMinutes) + 0.2989558 * Math.exp(-0.1932605 * durationMinutes);

  // VDOT = VO2 / %VO2max
  return vo2 / pctVo2max;
}

/**
 * Predict the race time (seconds) for a given VDOT at a given distance —
 * the Daniels "equivalent performance" / race predictor. Inverts calculateVdot.
 *
 * For a fixed distance, calculateVdot is monotonically DECREASING in duration:
 * a faster time (smaller t) sustains a higher %VO2max at a higher velocity and
 * therefore implies a higher VDOT. So we binary-search the duration whose VDOT
 * matches the target. The required VDOT to hit a target time is, conversely,
 * simply calculateVdot(distance, targetTime).
 */
export function predictRaceTime(vdot: number, distanceMeters: number): number {
  if (vdot <= 0 || distanceMeters <= 0) return 0;
  const km = distanceMeters / 1000;
  // Bracket the search with implausibly fast/slow paces so any real VDOT lands inside.
  let lo = km * 120; // 2:00/km
  let hi = km * 900; // 15:00/km
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = calculateVdot(distanceMeters, mid);
    if (v > vdot) {
      // This time is too fast (VDOT above target) → athlete needs a slower time.
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round((lo + hi) / 2);
}

/**
 * Given a VDOT score and a target %VO2max, calculate the corresponding pace (seconds per km)
 * Uses the inverse of the VO2-velocity relationship.
 */
export function velocityAtVo2(vo2: number): number {
  // Solve: vo2 = -4.60 + 0.182258*v + 0.000104*v^2
  // 0.000104*v^2 + 0.182258*v + (-4.60 - vo2) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - vo2;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  // Take the positive root
  return (-b + Math.sqrt(discriminant)) / (2 * a);  // meters per minute
}

/**
 * Convert velocity (m/min) to pace (seconds per km)
 */
function velocityToPace(velocityMPerMin: number): number {
  if (velocityMPerMin <= 0) return 0;
  return (1000 / velocityMPerMin) * 60;  // seconds per km
}

/**
 * Derive the 5 training pace zones from a VDOT score.
 * Returns paces in seconds per km.
 *
 * Zone percentages of VO2max (Jack Daniels):
 * Easy:       59-74%
 * Marathon:   75-84%
 * Threshold:  83-88%
 * Interval:   95-100%
 * Repetition: 105-110% (extrapolated)
 */
export interface PaceZones {
  easyPaceMin: number;
  easyPaceMax: number;
  marathonPaceMin: number;
  marathonPaceMax: number;
  thresholdPaceMin: number;
  thresholdPaceMax: number;
  intervalPaceMin: number;
  intervalPaceMax: number;
  repetitionPaceMin: number;
  repetitionPaceMax: number;
}

export function derivePaceZones(vdot: number): PaceZones {
  // For each zone, calculate the velocity at the target %VO2max
  // then convert to pace. Note: slower pace = higher seconds/km = min of the % range

  const paceAt = (pctVo2max: number): number => {
    const targetVo2 = vdot * pctVo2max;
    const velocity = velocityAtVo2(targetVo2);
    return Math.round(velocityToPace(velocity));
  };

  return {
    // Easy: 59-74% VO2max (slower = max seconds, faster = min seconds)
    easyPaceMin: paceAt(0.74),    // faster end
    easyPaceMax: paceAt(0.59),    // slower end
    // Marathon: 75-84%
    marathonPaceMin: paceAt(0.84),
    marathonPaceMax: paceAt(0.75),
    // Threshold: 83-88%
    thresholdPaceMin: paceAt(0.88),
    thresholdPaceMax: paceAt(0.83),
    // Interval: 95-100%
    intervalPaceMin: paceAt(1.00),
    intervalPaceMax: paceAt(0.95),
    // Repetition: 105-110%
    repetitionPaceMin: paceAt(1.10),
    repetitionPaceMax: paceAt(1.05),
  };
}

/**
 * Calculate Karvonen HR zones
 * target = restHR + %HRR * (maxHR - restHR)
 */
export interface HrZoneRanges {
  zone1: { min: number; max: number };
  zone2: { min: number; max: number };
  zone3: { min: number; max: number };
  zone4: { min: number; max: number };
  zone5: { min: number; max: number };
}

export function deriveHrZones(maxHR: number, restHR: number): HrZoneRanges {
  const hrr = maxHR - restHR;
  const at = (pct: number) => Math.round(restHR + pct * hrr);

  return {
    zone1: { min: at(0.59), max: at(0.74) },
    zone2: { min: at(0.74), max: at(0.84) },
    zone3: { min: at(0.84), max: at(0.88) },
    zone4: { min: at(0.88), max: at(0.95) },
    zone5: { min: at(0.95), max: at(1.00) },
  };
}

/**
 * Find the best effort from a list of runs.
 * Best effort = fastest pace at distance >= 1.5km
 */
export function findBestEffort(runs: Array<{ distanceMeters: number; durationSeconds: number }>): { distanceMeters: number; durationSeconds: number } | null {
  const eligible = runs.filter(r => r.distanceMeters >= 1500 && r.durationSeconds > 0);
  if (eligible.length === 0) return null;

  // Melhor esforço = o que produz o VDOT mais alto, NÃO o pace bruto mais rápido.
  // Um tiro curto e veloz (ex.: 1,6 km a 4:00) pode ter pace melhor que um tempo run
  // longo (5 km a 4:45) e ainda assim representar um VDOT menor, porque o esforço curto
  // roda em regime supramáximo. Ranquear por VDOT escolhe o esforço mais representativo.
  let best = eligible[0];
  let bestVdot = calculateVdot(best.distanceMeters, best.durationSeconds);
  for (let i = 1; i < eligible.length; i++) {
    const vdot = calculateVdot(eligible[i].distanceMeters, eligible[i].durationSeconds);
    if (vdot > bestVdot) {
      bestVdot = vdot;
      best = eligible[i];
    }
  }
  return best;
}

/**
 * Format pace from seconds per km to M:SS string
 */
export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Default VDOT for users with no data (~30 min 5K runner)
export const DEFAULT_VDOT = 30;
