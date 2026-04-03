import { getRecentActivities as fetchActivities } from '../stravaClient.js';
import { generateAiPlan, generateAssessmentPlan } from './aiPlannerService.js';
import type { PlannerResults, RunSummary } from '../types/planner.js';
import { formatPace, getNextMonday, getWeekDates } from '../utils/runningUtils.js';

export type { PlannerResults, WorkoutDay, RunAnalysis } from '../types/planner.js';

function isNoRunningDataError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('NO_RUNNING_DATA');
}

export class PlannerService {
  static async planNextWeek(
    token: string,
    numberOfRuns: number = 5,
    weekStartDate?: string,
  ): Promise<PlannerResults> {
    if (!token) {
      throw new Error('STRAVA_ACCESS_TOKEN is missing.');
    }

    const startMonday = weekStartDate ? new Date(weekStartDate) : getNextMonday();
    const weekDates = getWeekDates(startMonday);

    // --- 1. Try fetching runs from Strava ---
    let activities: Awaited<ReturnType<typeof fetchActivities>>;
    try {
      console.error(`Fetching recent activities to find ${numberOfRuns} runs...`);
      activities = await fetchActivities(token, 30);
    } catch (error) {
      if (isNoRunningDataError(error)) {
        console.error('NO_RUNNING_DATA — falling back to AI assessment plan.');
        return generateAssessmentPlan(weekDates);
      }
      throw error;
    }

    const runs = activities
      .filter((a) => a.type === 'Run' || a.sport_type === 'Run' || a.sport_type === 'TrailRun')
      .slice(0, numberOfRuns);

    // --- 2. No runs? Generate assessment plan instead of throwing ---
    if (runs.length === 0) {
      console.error('No recent runs found — generating AI assessment plan to test running level.');
      return generateAssessmentPlan(weekDates);
    }

    // --- 3. Compute aggregate stats ---
    const totalDist = runs.reduce((sum, r) => sum + (r.distance || 0), 0);
    const avgDist = totalDist / runs.length;
    const avgSpeed = runs.reduce((sum, r) => sum + (r.average_speed || 0), 0) / runs.length;

    const hrRuns = runs.filter((r) => r.average_heartrate);
    const avgHR =
      hrRuns.length > 0
        ? Math.round(hrRuns.reduce((sum, r) => sum + r.average_heartrate!, 0) / hrRuns.length)
        : null;

    const maxDist = Math.max(...runs.map((r) => r.distance || 0));

    const runSummaries: RunSummary[] = runs.map((r, i) => ({
      index: i + 1,
      name: r.name,
      date: new Date(r.start_date).toLocaleDateString(),
      distanceKm: parseFloat((r.distance / 1000).toFixed(2)),
      durationMin: r.moving_time ? Math.round(r.moving_time / 60) : null,
      avgPace: formatPace(r.average_speed),
      avgHR: r.average_heartrate ? Math.round(r.average_heartrate) : null,
      elevationGain: r.total_elevation_gain ?? null,
    }));

    // --- 4. Delegate to AI service ---
    return generateAiPlan({
      runSummaries,
      avgDistKm: avgDist / 1000,
      avgPace: formatPace(avgSpeed),
      avgHR,
      maxDistKm: maxDist / 1000,
      totalDistKm: totalDist / 1000,
      weekDates,
    });
  }
}
