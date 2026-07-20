/**
 * Goal feasibility engine — pure, deterministic, VDOT-based.
 *
 * Answers "does this dated goal make sense?" by comparing the athlete's CURRENT
 * VDOT against the VDOT REQUIRED to hit the target time, and projecting how much
 * VDOT they can realistically gain in the weeks remaining until the event.
 *
 * No framework or Prisma dependencies — trivially unit-testable.
 */
import { calculateVdot, predictRaceTime } from '../effort-zones/vdot-calculator';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type FeasibilityVerdict = 'ready' | 'feasible' | 'ambitious' | 'unrealistic';

export interface GoalFeasibility {
  verdict: FeasibilityVerdict;
  currentVdot: number;
  requiredVdot: number;
  projectedVdot: number;
  targetDistanceMeters: number;
  targetTimeSec: number;
  /** What the athlete would run TODAY at the target distance, given currentVdot. */
  currentProjectedTimeSec: number;
  weeksAvailable: number;
  /** true when currentVdot is a cold-start default rather than measured from runs. */
  lowConfidence: boolean;
  suggestion: {
    /** Achievable time at the target distance BY the event date (null when already feasible). */
    realisticTimeSec: number | null;
    /** Earliest date the target time becomes realistic (null when already feasible). */
    suggestedDate: string | null;
  };
}

// ── Calibration knobs (validar contra literatura antes de mexer) ───────────────
// Ganho de VDOT sustentável por semana, por nível de experiência. Iniciantes
// respondem mais rápido; avançados têm retornos decrescentes.
const BASE_WEEKLY_VDOT_GAIN: Record<ExperienceLevel, number> = {
  beginner: 0.35,
  intermediate: 0.2,
  advanced: 0.1,
};
const DEFAULT_WEEKLY_VDOT_GAIN = 0.2; // nível desconhecido
// Amortece o ganho conforme o VDOT atual sobe (quanto mais em forma, mais lento progride).
const FITNESS_DAMPING_FLOOR = 0.3;
// Teto absoluto de ganho numa única preparação — evita projeções fantasiosas em
// janelas muito longas.
const MAX_TOTAL_VDOT_GAIN = 12;
// Margem (em pontos de VDOT) entre "viável" e "inviável" → zona "ambicioso".
const AMBITIOUS_MARGIN_VDOT = 1;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round1 = (n: number) => Math.round(n * 10) / 10;

function weeklyVdotGain(currentVdot: number, experienceLevel: ExperienceLevel | null): number {
  const base = experienceLevel ? BASE_WEEKLY_VDOT_GAIN[experienceLevel] : DEFAULT_WEEKLY_VDOT_GAIN;
  const damping = clamp((70 - currentVdot) / 40, FITNESS_DAMPING_FLOOR, 1);
  return base * damping;
}

export interface FeasibilityInput {
  currentVdot: number;
  targetDistanceMeters: number;
  targetTimeSec: number;
  weeksAvailable: number;
  experienceLevel?: ExperienceLevel | null;
  /** ISO date used as "today" to derive the suggested alternative date. */
  startDateISO: string;
  lowConfidence?: boolean;
}

export function assessFeasibility(input: FeasibilityInput): GoalFeasibility {
  const {
    currentVdot,
    targetDistanceMeters,
    targetTimeSec,
    weeksAvailable,
    experienceLevel = null,
    startDateISO,
    lowConfidence = false,
  } = input;

  // The VDOT required to run the target time at the target distance IS its VDOT.
  const requiredVdot = calculateVdot(targetDistanceMeters, targetTimeSec);
  const gain = weeklyVdotGain(currentVdot, experienceLevel);
  const projectedVdot =
    currentVdot + Math.min(gain * Math.max(0, weeksAvailable), MAX_TOTAL_VDOT_GAIN);

  let verdict: FeasibilityVerdict;
  if (requiredVdot <= currentVdot) verdict = 'ready';
  else if (requiredVdot <= projectedVdot) verdict = 'feasible';
  else if (requiredVdot <= projectedVdot + AMBITIOUS_MARGIN_VDOT) verdict = 'ambitious';
  else verdict = 'unrealistic';

  const needsSuggestion = verdict === 'ambitious' || verdict === 'unrealistic';
  const realisticTimeSec = needsSuggestion
    ? predictRaceTime(projectedVdot, targetDistanceMeters)
    : null;
  let suggestedDate: string | null = null;
  if (needsSuggestion && gain > 0) {
    const weeksNeeded = Math.ceil((requiredVdot - currentVdot) / gain);
    suggestedDate = addWeeksISO(startDateISO, weeksNeeded);
  }

  return {
    verdict,
    currentVdot: round1(currentVdot),
    requiredVdot: round1(requiredVdot),
    projectedVdot: round1(projectedVdot),
    targetDistanceMeters,
    targetTimeSec,
    currentProjectedTimeSec: predictRaceTime(currentVdot, targetDistanceMeters),
    weeksAvailable,
    lowConfidence,
    suggestion: { realisticTimeSec, suggestedDate },
  };
}

/**
 * Convenience wrapper over a parsed goal: parses distance/time, derives the number
 * of weeks until the event, and returns null when the goal is not a dated,
 * quantifiable target (so callers can simply skip feasibility).
 */
export function assessGoalFeasibility(params: {
  goal: {
    targetDistance: string | null;
    targetTime: string | null;
    eventDate: string | null;
    experienceLevel?: ExperienceLevel | null;
  };
  currentVdot: number;
  asOfISO: string;
  lowConfidence?: boolean;
}): GoalFeasibility | null {
  const { goal, currentVdot, asOfISO, lowConfidence } = params;
  if (!goal.eventDate) return null;

  const targetDistanceMeters = parseTargetDistanceMeters(goal.targetDistance);
  const targetTimeSec = parseTargetTimeSeconds(goal.targetTime);
  if (targetDistanceMeters == null || targetTimeSec == null) return null;

  const weeksAvailable = weeksBetween(asOfISO, goal.eventDate);
  if (weeksAvailable == null || weeksAvailable < 0) return null; // event already passed

  return assessFeasibility({
    currentVdot,
    targetDistanceMeters,
    targetTimeSec,
    weeksAvailable,
    experienceLevel: goal.experienceLevel ?? null,
    startDateISO: asOfISO,
    lowConfidence,
  });
}

// ── Parsers ────────────────────────────────────────────────────────────────────

const KNOWN_DISTANCES: Record<string, number> = {
  '5k': 5000,
  '10k': 10000,
  '15k': 15000,
  '21k': 21097.5,
  '21.1k': 21097.5,
  half: 21097.5,
  meia: 21097.5,
  'meia maratona': 21097.5,
  '42k': 42195,
  '42.2k': 42195,
  full: 42195,
  marathon: 42195,
  maratona: 42195,
};

/** "5k" → 5000, "10k" → 10000, "21k"/half → 21097.5, "42k"/full → 42195, "8km" → 8000. */
export function parseTargetDistanceMeters(
  targetDistance: string | null | undefined,
): number | null {
  if (!targetDistance) return null;
  const s = targetDistance.trim().toLowerCase();
  if (KNOWN_DISTANCES[s] != null) return KNOWN_DISTANCES[s];

  const km = s.match(/^(\d+(?:[.,]\d+)?)\s*km?$/); // "10k", "10km", "21.1km"
  if (km) return parseFloat(km[1].replace(',', '.')) * 1000;
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*m(?:eters|etros)?$/); // "800m"
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

/** "HH:MM:SS"/"MM:SS"/"25min"/"1h30" → seconds. */
export function parseTargetTimeSeconds(targetTime: string | null | undefined): number | null {
  if (!targetTime) return null;
  const s = targetTime.trim().toLowerCase();

  const colon = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    const a = parseInt(colon[1], 10);
    const b = parseInt(colon[2], 10);
    if (colon[3] != null) return a * 3600 + b * 60 + parseInt(colon[3], 10); // HH:MM:SS
    return a * 60 + b; // MM:SS
  }

  const hm = s.match(/^(\d+)\s*h(?:\s*(\d{1,2}))?\s*m?(?:in)?$/); // "1h30", "2h"
  if (hm) return parseInt(hm[1], 10) * 3600 + (hm[2] ? parseInt(hm[2], 10) * 60 : 0);

  const min = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:min|minutos|m)$/); // "25min", "25m"
  if (min) return Math.round(parseFloat(min[1].replace(',', '.')) * 60);

  return null;
}

/** Whole weeks between two ISO dates (floor). null on unparseable input. */
export function weeksBetween(fromISO: string, toISO: string): number | null {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

function addWeeksISO(startISO: string, weeks: number): string {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}
