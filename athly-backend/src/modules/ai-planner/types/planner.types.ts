import { SportType } from '@prisma/client';

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
}

export interface RunAnalysis {
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
 * blocks contains structured workout details as JSON.
 */
export interface WorkoutDay {
  date: string; // YYYY-MM-DD → dateScheduled
  dayOfWeek: string;
  title: string;
  description: string;
  sportType: SportType; // running | walking | other | etc. → sportType
  intensity: number; // 1–10 → intensity
  blocks: WorkoutBlock[]; // → blocks (Json)
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
