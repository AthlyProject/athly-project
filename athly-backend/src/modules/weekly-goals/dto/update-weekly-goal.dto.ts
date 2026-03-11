import { IsOptional, IsDateString, IsEnum, IsObject } from 'class-validator';
import { WeeklyGoalStatus } from '@prisma/client';

export class UpdateWeeklyGoalInput {
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @IsOptional()
  @IsDateString()
  weekEndDate?: string;

  @IsOptional()
  @IsEnum(WeeklyGoalStatus)
  status?: WeeklyGoalStatus;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;
}
