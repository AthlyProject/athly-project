import { SportType, WorkoutStatus } from '@prisma/client';
export declare class WorkoutBlock {
    type: string;
    duration?: number;
    distance?: number;
    targetPace?: string;
    instructions?: string;
}
export declare class WorkoutModel {
    id: string;
    date: string;
    sportType: SportType;
    title: string;
    description?: string;
    blocks: WorkoutBlock[];
    status: WorkoutStatus;
    intensity?: number;
    stravaActivityId?: string | null;
}
export declare class WeekModel {
    number: number;
    workouts: WorkoutModel[];
}
export declare class TrainingPlanModel {
    id: string;
    startDate: string;
    weeks: WeekModel[];
}
export declare class WorkoutFeedbackModel {
    workoutId: string;
    completed: boolean;
    effort: number;
    fatigue: number;
}
