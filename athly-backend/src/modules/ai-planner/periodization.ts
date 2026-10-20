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
  /** Maior corrida das 4 semanas anteriores (km): âncora do longão. Sem ela, só o volume decide. */
  recentLongestRunKm?: number | null;
}

/** Teto do volume planejado de uma semana sobre a base ou o alvo (o backend usa o mesmo). */
export const WEEKLY_VOLUME_CAP_FACTOR = 1.1;

// ── Calibration knobs (validar contra periodização clássica antes de mexer) ─────
const WEEKLY_RAMP = 0.08; // +8%/semana de progressão (abaixo do teto de 10%)
const CUTBACK_FACTOR = 0.8; // semana de recuperação a cada 4ª progressão
const RACE_WEEK_VOLUME_FACTOR = 0.4; // volume da semana da prova vs. baseline
// Polimento sem semanas de base/construção antes (prova próxima): não há carga acumulada para
// dissipar, então o corte é menor (eval 2026-10-20: 0,5 tirava metade do volume na véspera).
const TAPER_FACTOR_WITHOUT_BUILD_UP = 0.75;
// Longão na base/construção/pico: a fração do volume, entre 0,8 e 1,1 × o maior treino recente.
const LONG_RUN_MIN_OF_RECENT = 0.8;
const LONG_RUN_MAX_OF_RECENT = 1.1;
// Longão no polimento: 0,65 × o maior treino recente, até metade do teto da semana. A fração do
// volume já reduzido dava 1,5–3,7 km a 12 dias de uma meia.
const TAPER_LONG_RUN_OF_RECENT = 0.65;
const TAPER_LONG_RUN_OF_WEEK_CAP = 0.5;
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
 * Longão de referência de uma semana. O esqueleto do macrociclo é gravado na primeira geração, e o
 * backend recalcula este valor a cada semana com o maior treino recente: com o valor do início do
 * plano ele ficava preso em 1,1 × o longão de então (eval de 2026-10-20: referência de 13,2 km
 * para quem já corria 15,7 km). Como a âncora é a corrida recente, o longão sobe até 10% por vez.
 */
export function longRunReferenceKm(params: {
  phase: TrainingPhase;
  targetVolumeKm: number;
  targetDistanceMeters: number;
  /** Maior corrida das 4 semanas anteriores (km). Sem ela, só o volume decide. */
  recentLongestRunKm?: number | null;
}): number {
  const { phase, targetVolumeKm } = params;
  const raceKm = params.targetDistanceMeters / 1000;
  if (phase === 'race') return raceKm;
  const recentLongest =
    params.recentLongestRunKm && params.recentLongestRunKm > 0 ? params.recentLongestRunKm : null;
  // Para provas curtas (5k/10k) os longões de base podem passar da distância de prova, e quem já
  // corre mais longe mantém o longão que tem (o teto de 8 km cortava um longão habitual de 21 km);
  // para provas longas (meia/maratona) o longão fica abaixo da distância de prova.
  const longRunCap = raceKm <= 12 ? Math.max(raceKm * 1.6, recentLongest ?? 0) : raceKm * 1.1;
  const byVolume = targetVolumeKm * longRunFraction(phase);
  if (recentLongest === null) return Math.min(longRunCap, byVolume);
  if (phase === 'taper') {
    return Math.min(
      longRunCap,
      recentLongest * TAPER_LONG_RUN_OF_RECENT,
      targetVolumeKm * WEEKLY_VOLUME_CAP_FACTOR * TAPER_LONG_RUN_OF_WEEK_CAP,
    );
  }
  const anchored = Math.min(
    Math.max(byVolume, recentLongest * LONG_RUN_MIN_OF_RECENT),
    recentLongest * LONG_RUN_MAX_OF_RECENT,
  );
  // O longão nunca passa do volume da semana inteira.
  return Math.min(longRunCap, anchored, targetVolumeKm);
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

  const maxFactor = experienceLevel
    ? MAX_VOLUME_FACTOR[experienceLevel]
    : DEFAULT_MAX_VOLUME_FACTOR;
  const maxVolume = currentWeeklyVolumeKm * maxFactor;

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
      const factor =
        progressionCount === 0
          ? TAPER_FACTOR_WITHOUT_BUILD_UP
          : 0.5 + 0.25 * ((weeksToRace - 1) / span);
      targetVolumeKm = peakVolume * factor;
    } else {
      // race week
      targetVolumeKm = currentWeeklyVolumeKm * RACE_WEEK_VOLUME_FACTOR;
    }

    const longRunKm = longRunReferenceKm({
      phase,
      targetVolumeKm,
      targetDistanceMeters,
      recentLongestRunKm: input.recentLongestRunKm,
    });

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
