/**
 * Pure weekly-metrics helpers shared by the AI planner (mid-plan context) and the
 * training-report service (laudo capture). No Prisma/Nest dependency — the caller
 * passes already-loaded weekly goals (with workouts + feedback).
 */
import type { LongitudinalWeek } from './prompts/planner-prompt';
import type { PreviousWeekAnalysis } from './types/planner.types';

type FeedbackLike = { effort: number; fatigue: number };

export type WorkoutLike = {
  title: string;
  dateScheduled: Date;
  status: string;
  sportType: string;
  actualDistanceMeters?: number | null;
  blocks: unknown;
  feedback: FeedbackLike[];
};

export type WeeklyGoalLike = {
  createdAt: Date;
  metrics: unknown;
  workouts: WorkoutLike[];
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
): number {
  let totalKm = 0;
  for (const w of workouts.filter((w) => w.status === 'done')) {
    if (typeof w.actualDistanceMeters === 'number' && w.actualDistanceMeters > 0) {
      totalKm += w.actualDistanceMeters / 1000;
      continue;
    }
    const blocks = w.blocks as any[];
    if (Array.isArray(blocks)) {
      for (const block of blocks) {
        const km =
          typeof block?.distance === 'number' && block.distance > 0
            ? block.distance
            : typeof block?.distanceKm === 'number' && block.distanceKm > 0
              ? block.distanceKm
              : 0;
        totalKm += km;
      }
    }
  }
  return totalKm;
}

/**
 * Builds the longitudinal trend rows from weekly goals ordered newest-first.
 * Returns them oldest-first so the AI reads chronological progression naturally.
 */
export function computeLongitudinalWeeks(goalsNewestFirst: WeeklyGoalLike[]): LongitudinalWeek[] {
  const n = goalsNewestFirst.length;
  return [...goalsNewestFirst].reverse().map((goal, idx) => {
    const workouts = adherenceEligibleWorkouts(goal.workouts, goal.createdAt);
    const doneWorkouts = workouts.filter((w) => w.status === 'done');
    const completionRate =
      workouts.length > 0 ? parseFloat((doneWorkouts.length / workouts.length).toFixed(2)) : 0;
    const totalKm = executedVolumeKm(goal.workouts);
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
      ? parseFloat((allFeedback.reduce((sum, f) => sum + f.effort, 0) / allFeedback.length).toFixed(1))
      : null;
  const avgFatigue =
    allFeedback.length > 0
      ? parseFloat((allFeedback.reduce((sum, f) => sum + f.fatigue, 0) / allFeedback.length).toFixed(1))
      : null;

  const totalDistanceKm = executedVolumeKm(previousGoal.workouts);

  const baselineGoal = goalsNewestFirst[1];
  const baselineKm = baselineGoal ? executedVolumeKm(baselineGoal.workouts) : 0;
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
  };
}
