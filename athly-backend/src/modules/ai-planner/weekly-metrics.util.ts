/**
 * Pure weekly-metrics helpers shared by the AI planner (mid-plan context) and the
 * training-report service (laudo capture). No Prisma/Nest dependency — the caller
 * passes already-loaded weekly goals (with workouts + feedback).
 */
import type { LongitudinalWeek } from './prompts/planner-prompt';
import type { PreviousWeekAnalysis } from './types/planner.types';

type FeedbackLike = { effort: number; fatigue: number; completed?: boolean };

export type WorkoutLike = {
  id?: string;
  title: string;
  dateScheduled: Date;
  status: string;
  sportType: string;
  appleHealthWorkoutUUID?: string | null;
  actualDistanceMeters?: number | null;
  blocks: unknown;
  feedback: FeedbackLike[];
};

export type DetailedSessionLike = {
  startDate: string;
  appleHealthWorkoutUUID?: string | null;
  athlyWorkoutId?: string | null;
  distanceMeters: number;
  durationSeconds?: number;
};

export type VolumeConfidence = 'high' | 'corrected' | 'low';

export type ExecutedVolumeOptions = {
  detailedSessions?: DetailedSessionLike[];
};

export type WeeklyGoalLike = {
  createdAt: Date;
  metrics: unknown;
  workouts: WorkoutLike[];
  // Janela da semana (presente nas goals vindas do Prisma). Necessária para somar
  // corridas avulsas (fora do plano) ao volume executado da semana.
  weekStartDate?: Date;
  weekEndDate?: Date;
};

/**
 * Treinos que o atleta teve chance real de cumprir: exclui do denominador os dias
 * que já estavam no passado quando a semana foi gerada. Treino passado que ainda
 * assim foi concluído conta a favor.
 */
export function adherenceEligibleWorkouts<
  T extends { dateScheduled: Date; status: string; sportType: string },
>(workouts: T[], goalCreatedAt: Date): T[] {
  const generationDayUtc = new Date(goalCreatedAt);
  generationDayUtc.setUTCHours(0, 0, 0, 0);
  return workouts.filter(
    (w) => w.sportType !== 'other' && (w.status === 'done' || w.dateScheduled >= generationDayUtc),
  );
}

/**
 * Volume executado de uma semana: prefere actualDistanceMeters (HK linkado) e cai
 * para a distância prescrita nos blocks (`distance` em km; `distanceKm` cobre dados antigos).
 */
export function executedVolumeKm(
  workouts: Array<{ status: string; actualDistanceMeters?: number | null; blocks: unknown }>,
  options: ExecutedVolumeOptions = {},
): number {
  let totalKm = 0;
  const sessions = normalizeSessions(options.detailedSessions ?? []);
  for (const w of workouts.filter((w) => w.status === 'done')) {
    const workout = w as WorkoutLike;
    const prescribedKm = prescribedVolumeKm(workout.blocks);
    const actualKm =
      typeof workout.actualDistanceMeters === 'number' && workout.actualDistanceMeters > 0
        ? workout.actualDistanceMeters / 1000
        : null;
    const sessionKm = bestMatchingSessionKm(workout, sessions);

    if (actualKm !== null) {
      totalKm += selectTrustedActualKm(workout, actualKm, prescribedKm, sessionKm);
      continue;
    }

    if (sessionKm !== null) {
      totalKm += sessionKm;
      continue;
    }

    totalKm += prescribedKm;
  }
  return totalKm;
}

export function volumeConfidence(
  workouts: WorkoutLike[],
  options: ExecutedVolumeOptions = {},
): VolumeConfidence {
  const sessions = normalizeSessions(options.detailedSessions ?? []);
  let corrected = false;
  let low = false;

  for (const workout of workouts.filter((w) => w.status === 'done')) {
    const prescribedKm = prescribedVolumeKm(workout.blocks);
    const actualKm =
      typeof workout.actualDistanceMeters === 'number' && workout.actualDistanceMeters > 0
        ? workout.actualDistanceMeters / 1000
        : null;
    const sessionKm = bestMatchingSessionKm(workout, sessions);

    if (actualKm !== null && isSuspiciousActual(workout, actualKm, prescribedKm)) {
      if (sessionKm !== null && sessionKm > actualKm) corrected = true;
      else low = true;
    } else if (actualKm === null && sessionKm === null && prescribedKm > 0) {
      low = true;
    }
  }

  if (corrected) return 'corrected';
  if (low) return 'low';
  return 'high';
}

function selectTrustedActualKm(
  workout: WorkoutLike,
  actualKm: number,
  prescribedKm: number,
  sessionKm: number | null,
): number {
  if (!isSuspiciousActual(workout, actualKm, prescribedKm)) return actualKm;
  if (sessionKm !== null && sessionKm > actualKm) return sessionKm;
  return actualKm;
}

function isSuspiciousActual(workout: WorkoutLike, actualKm: number, prescribedKm: number): boolean {
  const completed = workout.feedback.some((f) => f.completed === true);
  const tooSmallAbsolute = actualKm < 0.5;
  const tooSmallVsPlan = prescribedKm > 0 && actualKm < prescribedKm * 0.3;

  return tooSmallAbsolute || (completed && tooSmallVsPlan);
}

function prescribedVolumeKm(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0;
  return blocks.reduce((sum, block: any) => {
    const km =
      typeof block?.distance === 'number' && block.distance > 0
        ? block.distance
        : typeof block?.distanceKm === 'number' && block.distanceKm > 0
          ? block.distanceKm
          : 0;
    return sum + km;
  }, 0);
}

function normalizeSessions(sessions: DetailedSessionLike[]): DetailedSessionLike[] {
  return sessions.filter(
    (s) => s.distanceMeters >= 500 && !Number.isNaN(new Date(s.startDate).getTime()),
  );
}

function bestMatchingSessionKm(
  workout: WorkoutLike,
  sessions: DetailedSessionLike[],
): number | null {
  if (sessions.length === 0) return null;

  const sameWorkout = sessions.filter((s) => workout.id && s.athlyWorkoutId === workout.id);
  const sameUuid = sessions.filter(
    (s) =>
      workout.appleHealthWorkoutUUID && s.appleHealthWorkoutUUID === workout.appleHealthWorkoutUUID,
  );
  const sameDay = sessions.filter((s) => dateKey(s.startDate) === dateKey(workout.dateScheduled));
  const candidates = [...sameWorkout, ...sameUuid, ...sameDay];
  if (candidates.length === 0) return null;

  return Math.max(...candidates.map((s) => s.distanceMeters / 1000));
}

function dateKey(date: string | Date): string {
  return (date instanceof Date ? date : new Date(date)).toISOString().split('T')[0];
}

/**
 * Volume de corridas avulsas da semana: sessões do Apple Health (ex.: Amazfit/Zepp,
 * Nike) dentro da janela da goal que NÃO correspondem a nenhum treino prescrito
 * concluído. Sem isso, corridas feitas fora do plano escreviam no HealthKit e
 * apareciam no detalhe das sessões, mas eram ignoradas no volume executado — a
 * base de progressão subestimava o atleta.
 * Exclui sessões casadas com treinos 'done' (por id, UUID ou mesmo dia) porque
 * essas já entram via executedVolumeKm (correção de distância).
 */
export function unplannedSessionsKm(
  goal: WeeklyGoalLike,
  options: ExecutedVolumeOptions = {},
): number {
  if (!goal.weekStartDate || !goal.weekEndDate) return 0;
  const startKey = dateKey(goal.weekStartDate);
  const endKey = dateKey(goal.weekEndDate);
  const doneWorkouts = goal.workouts.filter((w) => w.status === 'done');

  return normalizeSessions(options.detailedSessions ?? [])
    .filter((s) => {
      const day = dateKey(s.startDate);
      return day >= startKey && day <= endKey;
    })
    .filter(
      (s) =>
        !doneWorkouts.some(
          (w) =>
            (w.id && s.athlyWorkoutId === w.id) ||
            (w.appleHealthWorkoutUUID &&
              s.appleHealthWorkoutUUID === w.appleHealthWorkoutUUID) ||
            dateKey(s.startDate) === dateKey(w.dateScheduled),
        ),
    )
    .reduce((sum, s) => sum + s.distanceMeters / 1000, 0);
}

/**
 * Builds the longitudinal trend rows from weekly goals ordered newest-first.
 * Returns them oldest-first so the AI reads chronological progression naturally.
 */
export function computeLongitudinalWeeks(
  goalsNewestFirst: WeeklyGoalLike[],
  options: ExecutedVolumeOptions = {},
): LongitudinalWeek[] {
  const n = goalsNewestFirst.length;
  return [...goalsNewestFirst].reverse().map((goal, idx) => {
    const workouts = adherenceEligibleWorkouts(goal.workouts, goal.createdAt);
    const doneWorkouts = workouts.filter((w) => w.status === 'done');
    const completionRate =
      workouts.length > 0 ? parseFloat((doneWorkouts.length / workouts.length).toFixed(2)) : 0;
    const totalKm = executedVolumeKm(goal.workouts, options) + unplannedSessionsKm(goal, options);
    const metrics = (goal.metrics ?? {}) as { avgPace?: string };
    const allFeedback = workouts.flatMap((w) => w.feedback);
    const avgEffort =
      allFeedback.length > 0
        ? parseFloat(
            (allFeedback.reduce((sum, f) => sum + f.effort, 0) / allFeedback.length).toFixed(1),
          )
        : null;
    return {
      weekLabel: `W-${n - idx}`,
      totalKm: parseFloat(totalKm.toFixed(2)),
      avgPace: metrics.avgPace ?? 'N/A',
      completionRate,
      avgEffort,
    };
  });
}

/**
 * Builds the previous-week analysis from weekly goals ordered newest-first:
 * [0] = the week analyzed; [1] = baseline for the volume-change comparison.
 * Returns null when there is no prior week.
 */
export function computePreviousWeekAnalysis(
  goalsNewestFirst: WeeklyGoalLike[],
  options: ExecutedVolumeOptions = {},
): PreviousWeekAnalysis | null {
  const previousGoal = goalsNewestFirst[0];
  if (!previousGoal) return null;

  const trainingWorkouts = adherenceEligibleWorkouts(previousGoal.workouts, previousGoal.createdAt);
  const completedWorkouts = trainingWorkouts.filter((w) => w.status === 'done').length;
  const totalWorkouts = trainingWorkouts.length;
  const skippedWorkouts = trainingWorkouts
    .filter((w) => w.status === 'skipped')
    .map((w) => w.title);

  const allFeedback = trainingWorkouts.flatMap((w) => w.feedback);
  const avgEffort =
    allFeedback.length > 0
      ? parseFloat(
          (allFeedback.reduce((sum, f) => sum + f.effort, 0) / allFeedback.length).toFixed(1),
        )
      : null;
  const avgFatigue =
    allFeedback.length > 0
      ? parseFloat(
          (allFeedback.reduce((sum, f) => sum + f.fatigue, 0) / allFeedback.length).toFixed(1),
        )
      : null;

  const totalDistanceKm =
    executedVolumeKm(previousGoal.workouts, options) + unplannedSessionsKm(previousGoal, options);

  const baselineGoal = goalsNewestFirst[1];
  const baselineKm = baselineGoal
    ? executedVolumeKm(baselineGoal.workouts, options) + unplannedSessionsKm(baselineGoal, options)
    : 0;
  let volumeChange = 'sem dados anteriores';
  if (baselineKm > 0 && totalDistanceKm > 0) {
    const pctChange = ((totalDistanceKm - baselineKm) / baselineKm) * 100;
    if (pctChange > 5) volumeChange = `aumentou ${Math.round(pctChange)}%`;
    else if (pctChange < -5) volumeChange = `reduziu ${Math.round(Math.abs(pctChange))}%`;
    else volumeChange = 'manteve';
  }

  const completionRate =
    totalWorkouts > 0 ? parseFloat((completedWorkouts / totalWorkouts).toFixed(2)) : 0;
  return {
    completedWorkouts,
    totalWorkouts,
    completionRate,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    avgEffort,
    avgFatigue,
    skippedWorkouts,
    volumeChange,
    volumeConfidence: volumeConfidence(previousGoal.workouts, options),
  };
}
