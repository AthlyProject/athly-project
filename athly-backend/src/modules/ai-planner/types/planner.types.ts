import { SportType } from '@prisma/client';
import type { Segment } from '../../workouts/types/segment.types';

export type { SportType };

export interface StravaActivity {
  id?: number;
  name: string;
  distance: number;
  start_date: string;
  type?: string;
  sport_type?: string;
  moving_time?: number;
  total_elevation_gain?: number;
  average_speed?: number;
  average_heartrate?: number;
}

export interface RunSummary {
  index: number;
  name: string;
  date: string;
  distanceKm: number;
  durationMin: number | null;
  avgPace: string;
  avgHR: number | null;
  elevationGain: number | null;
}

export interface AiPlannerInput {
  runSummaries: RunSummary[];
  avgDistKm: number;
  avgPace: string;
  avgHR: number | null;
  maxDistKm: number;
  totalDistKm: number;
  weekDates: string[];
  trainingDays: number;
  availableDays: string[];
}

export interface RunAnalysis {
  title: string;
  runsAnalyzed: number;
  period: string;
  avgDistanceKm: number;
  avgPace: string;
  avgHeartRate: number | null;
  totalDistanceKm: number;
  trend: string;
  fitnessInsights: string;
}

/**
 * Maps directly to the Prisma Workout model fields.
 * sportType must match Prisma SportType enum values.
 * intensity is 1–10 (rest days = 1, easy = 3, moderate = 6, high = 9).
 * segments contains the structured, sport-agnostic workout tree (warmup/work/recovery/cooldown/rest/set).
 * The legacy `blocks` field is derived server-side via flattenToLegacyBlocks for backward compatibility.
 */
export interface WorkoutDay {
  date: string; // YYYY-MM-DD → dateScheduled
  dayOfWeek: string;
  title: string;
  description: string;
  sportType: SportType;
  intensity: number;
  segments: Segment[]; // → workout.segments (Json), source of truth
  reasoning?: string;
  isGoalAttempt?: boolean;
}

export interface WorkoutBlock {
  type: string; // "warmup" | "main" | "cooldown" | "rest"
  distanceKm?: number;
  durationMinutes?: number;
  targetPace?: string;
  instructions?: string;
}

export interface PlannerResults {
  analysis: RunAnalysis;
  weekPlan: WorkoutDay[];
}

export interface PreviousWeekAnalysis {
  completedWorkouts: number;
  totalWorkouts: number;
  completionRate: number;
  totalDistanceKm: number;
  avgEffort: number | null;
  avgFatigue: number | null;
  skippedWorkouts: string[];
  volumeChange: string;
  adherenceNote: string;
}
