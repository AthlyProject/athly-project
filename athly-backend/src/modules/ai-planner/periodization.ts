/**
 * Macrocycle builder — pure, deterministic.
 *
 * Given a plan start, an event date and a baseline weekly volume, lays out a
 * week-by-week skeleton (phase + volume targets) counting down to race day:
 *   base → build → peak → taper → race
 *
 * The server owns this periodization math; the LLM only fills in the daily
 * workouts for one week at a time, using the current week's phase/targets as
 * context. No framework or Prisma dependencies — unit-testable.
 */
import type { ExperienceLevel } from './goal-feasibility';

export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'race';

export interface PlannedWeek {
  weekIndex: number; // 0-based from plan start
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string; // YYYY-MM-DD (Sunday)
  phase: TrainingPhase;
  weeksToEvent: number; // 0 = race week
  targetVolumeKm: number;
  longRunKm: number;
  intensityFocus: string; // short pt-BR label for the prompt
  isRaceWeek: boolean;
}

export interface MacrocycleInput {
  startMondayISO: string; // first Monday of the plan (week 0 start), YYYY-MM-DD
  eventDate: string; // YYYY-MM-DD
  targetDistanceMeters: number;
  currentWeeklyVolumeKm: number; // baseline weekly volume the ramp starts from
  experienceLevel?: ExperienceLevel | null;
}

// ── Calibration knobs (validar contra periodização clássica antes de mexer) ─────
const WEEKLY_RAMP = 0.08; // +8%/semana de progressão (abaixo do teto de 10%)
const CUTBACK_FACTOR = 0.8; // semana de recuperação a cada 4ª progressão
const RACE_WEEK_VOLUME_FACTOR = 0.4; // volume da semana da prova vs. baseline
const MAX_VOLUME_FACTOR: Record<ExperienceLevel, number> = {
  beginner: 1.4,
  intermediate: 1.6,
  advanced: 1.8,
};
const DEFAULT_MAX_VOLUME_FACTOR = 1.5;

const PHASE_FOCUS: Record<TrainingPhase, string> = {
  base: 'Volume fácil e construção de base aeróbica',
  build: 'Limiar (tempo) e intervalos progressivos',
  peak: 'Qualidade específica no pace alvo',
  taper: 'Afinamento: reduzir volume mantendo toques curtos no pace alvo',
  race: 'Semana da prova: tentativa do objetivo',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function addDaysISO(startISO: string, days: number): string {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function taperWeeksFor(distanceMeters: number): number {
  const km = distanceMeters / 1000;
  if (km <= 12) return 1; // 5k / 10k
  if (km <= 25) return 2; // half
  return 3; // marathon+
}

function longRunFraction(phase: TrainingPhase): number {
  switch (phase) {
    case 'base':
      return 0.3;
    case 'build':
    case 'peak':
      return 0.35;
    case 'taper':
      return 0.3;
    default:
      return 0;
  }
}

/**
 * Builds the macrocycle from plan start through the race week (inclusive).
 * Returns [] when the event is in the past relative to the start Monday.
 */
export function buildMacrocycle(input: MacrocycleInput): PlannedWeek[] {
  const { startMondayISO, eventDate, targetDistanceMeters, currentWeeklyVolumeKm } = input;
  const experienceLevel = input.experienceLevel ?? null;

  const start = new Date(startMondayISO);
  const event = new Date(eventDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(event.getTime())) return [];
  const diffDays = Math.floor((event.getTime() - start.getTime()) / DAY_MS);
  const raceWeekIndex = Math.floor(diffDays / 7);
  if (raceWeekIndex < 0) return [];

  const taperWeeks = Math.min(taperWeeksFor(targetDistanceMeters), raceWeekIndex);
  const preTaper = raceWeekIndex - taperWeeks; // weeks in base+build+peak region

  // Sub-allocate the pre-taper region into base / build / peak.
  let baseWeeks = 0;
  let buildWeeks = 0;
  let peakWeeks = 0;
  if (preTaper > 0) {
    peakWeeks = preTaper >= 3 ? Math.max(1, Math.round(preTaper * 0.15)) : 0;
    baseWeeks = Math.round(preTaper * 0.5);
    buildWeeks = preTaper - baseWeeks - peakWeeks;
    if (buildWeeks < 0) {
      buildWeeks = 0;
      baseWeeks = preTaper - peakWeeks;
    }
  }

  const phaseForWeek = (index: number): TrainingPhase => {
    if (index === raceWeekIndex) return 'race';
    if (index >= preTaper) return 'taper';
    if (index < baseWeeks) return 'base';
    if (index < baseWeeks + buildWeeks) return 'build';
    return 'peak';
  };

  const maxFactor = experienceLevel ? MAX_VOLUME_FACTOR[experienceLevel] : DEFAULT_MAX_VOLUME_FACTOR;
  const maxVolume = currentWeeklyVolumeKm * maxFactor;
  const raceKm = targetDistanceMeters / 1000;
  // Para provas curtas (5k/10k) os longões de base podem passar da distância de prova;
  // para provas longas (meia/maratona) o longão fica abaixo da distância de prova.
  const longRunCap = raceKm <= 12 ? raceKm * 1.6 : raceKm * 1.1;

  const weeks: PlannedWeek[] = [];
  let baseline = currentWeeklyVolumeKm; // climbing baseline (ignores cutbacks)
  let progressionCount = 0; // base/build weeks seen so far
  let peakVolume = currentWeeklyVolumeKm; // highest weekly volume reached

  for (let index = 0; index <= raceWeekIndex; index++) {
    const phase = phaseForWeek(index);
    let targetVolumeKm: number;

    if (phase === 'base' || phase === 'build') {
      if (progressionCount > 0) baseline = Math.min(maxVolume, baseline * (1 + WEEKLY_RAMP));
      progressionCount += 1;
      const isCutback = progressionCount % 4 === 0; // every 4th progression week = recovery
      targetVolumeKm = isCutback ? baseline * CUTBACK_FACTOR : baseline;
      peakVolume = Math.max(peakVolume, targetVolumeKm);
    } else if (phase === 'peak') {
      baseline = Math.min(maxVolume, baseline);
      targetVolumeKm = baseline; // hold volume, raise specificity
      peakVolume = Math.max(peakVolume, targetVolumeKm);
    } else if (phase === 'taper') {
      const weeksToRace = raceWeekIndex - index; // 1..taperWeeks
      // closest to race = lowest (0.5×peak); furthest = 0.75×peak
      const span = Math.max(1, taperWeeks - 1);
      const factor = 0.5 + 0.25 * ((weeksToRace - 1) / span);
      targetVolumeKm = peakVolume * factor;
    } else {
      // race week
      targetVolumeKm = currentWeeklyVolumeKm * RACE_WEEK_VOLUME_FACTOR;
    }

    const longRunKm =
      phase === 'race'
        ? raceKm
        : Math.min(longRunCap, targetVolumeKm * longRunFraction(phase));

    weeks.push({
      weekIndex: index,
      weekStartDate: addDaysISO(startMondayISO, index * 7),
      weekEndDate: addDaysISO(startMondayISO, index * 7 + 6),
      phase,
      weeksToEvent: raceWeekIndex - index,
      targetVolumeKm: round1(targetVolumeKm),
      longRunKm: round1(longRunKm),
      intensityFocus: PHASE_FOCUS[phase],
      isRaceWeek: phase === 'race',
    });
  }

  return weeks;
}
