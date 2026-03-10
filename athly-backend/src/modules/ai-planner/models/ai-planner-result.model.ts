import { ApiProperty } from '@nestjs/swagger';
import { TrainingPlanModel } from '../../training-plans/models/training-plan.model';
import { WeeklyGoalModel } from '../../weekly-goals/models/weekly-goal.model';
import { WorkoutModel } from '../../workouts/models/workout.model';

export class AiPlannerResultModel {
  @ApiProperty({ type: TrainingPlanModel })
  trainingPlan: Partial<TrainingPlanModel>;

  @ApiProperty({ type: WeeklyGoalModel })
  weeklyGoal: WeeklyGoalModel;

  @ApiProperty({ type: [WorkoutModel] })
  workouts: WorkoutModel[];

  @ApiProperty()
  analysis: any;

  @ApiProperty()
  isAssessment: boolean;
}
