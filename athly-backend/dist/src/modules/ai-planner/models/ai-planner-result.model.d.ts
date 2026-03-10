import { TrainingPlanModel } from '../../training-plans/models/training-plan.model';
import { WeeklyGoalModel } from '../../weekly-goals/models/weekly-goal.model';
import { WorkoutModel } from '../../workouts/models/workout.model';
export declare class AiPlannerResultModel {
    trainingPlan: Partial<TrainingPlanModel>;
    weeklyGoal: WeeklyGoalModel;
    workouts: WorkoutModel[];
    analysis: any;
    isAssessment: boolean;
}
