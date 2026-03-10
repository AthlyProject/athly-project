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
export interface WorkoutDay {
    date: string;
    dayOfWeek: string;
    title: string;
    description: string;
    sportType: SportType;
    intensity: number;
    blocks: WorkoutBlock[];
}
export interface WorkoutBlock {
    type: string;
    distanceKm?: number;
    durationMinutes?: number;
    targetPace?: string;
    instructions?: string;
}
export interface PlannerResults {
    analysis: RunAnalysis;
    weekPlan: WorkoutDay[];
}
