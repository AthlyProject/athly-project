import { SportType, WorkoutStatus } from '@prisma/client';

export class WorkoutBlock {
  type: string;
  duration?: number;
  distance?: number;
  targetPace?: string;
  instructions?: string;
}

export class WorkoutModel {
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

export class WeekModel {
  number: number;
  workouts: WorkoutModel[];
}

export class TrainingPlanModel {
  id: string;
  startDate: string;
  weeks: WeekModel[];
}

export class WorkoutFeedbackModel {
  workoutId: string;
  completed: boolean;
  effort: number;
  fatigue: number;
}
