import { IsString, IsNotEmpty, IsDateString, IsOptional, IsObject } from 'class-validator';

export class CreateWeeklyGoalInput {
  @IsString()
  @IsNotEmpty()
  trainingPlanId: string;

  @IsDateString()
  weekStartDate: string;

  @IsDateString()
  weekEndDate: string;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;
}
