import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SportType, WorkoutStatus } from '@prisma/client';

export class WorkoutBlock {
  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  duration?: number;

  @ApiPropertyOptional()
  distance?: number;

  @ApiPropertyOptional()
  targetPace?: string;

  @ApiPropertyOptional()
  instructions?: string;
}

export class WorkoutModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: string;

  @ApiProperty({ enum: SportType })
  sportType: SportType;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ type: [WorkoutBlock] })
  blocks: WorkoutBlock[];

  @ApiProperty({ enum: WorkoutStatus })
  status: WorkoutStatus;

  @ApiPropertyOptional()
  trainingPlanId?: string;

  @ApiPropertyOptional()
  weeklyGoalId?: string;

  @ApiPropertyOptional()
  intensity?: number;

  @ApiPropertyOptional({ nullable: true })
  stravaActivityId?: string | null;
}

export class WeekModel {
  @ApiProperty()
  number: number;

  @ApiProperty({ type: [WorkoutModel] })
  workouts: WorkoutModel[];
}

export class TrainingPlanModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startDate: string;

  @ApiProperty({ type: [WeekModel] })
  weeks: WeekModel[];
}

export class WorkoutFeedbackModel {
  @ApiProperty()
  workoutId: string;

  @ApiProperty()
  completed: boolean;

  @ApiProperty()
  effort: number;

  @ApiProperty()
  fatigue: number;
}
