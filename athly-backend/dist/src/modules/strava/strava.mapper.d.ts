import { SportType } from '@prisma/client';
export interface StravaRawActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type?: string;
    sport_type?: string;
    start_date: string;
    average_speed?: number;
    average_heartrate?: number;
    suffer_score?: number;
}
export declare function mapStravaSportType(activity: StravaRawActivity): SportType;
export declare function deriveIntensity(activity: StravaRawActivity): number;
export declare function formatPaceFromSpeed(speedMs: number): string;
export declare function buildStravaWorkoutBlock(activity: StravaRawActivity): {
    type: string;
    distanceKm: number;
    durationMinutes: number;
    targetPace: string | undefined;
    instructions: string;
};
