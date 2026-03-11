import { Type } from 'class-transformer';
import {
  Max,
  Min,
  ValidateNested,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { SportType, WorkoutStatus } from '@prisma/client';
import { WorkoutBlockInput } from './workout-update.dto';

export class CreateWorkoutInput {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  trainingPlanId: string;

  @IsString()
  @IsOptional()
  weeklyGoalId?: string;

  @IsEnum(SportType)
  sportType: SportType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutBlockInput)
  blocks?: WorkoutBlockInput[];

  @IsEnum(WorkoutStatus)
  status: WorkoutStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  intensity?: number;
}
