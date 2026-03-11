import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
} from 'class-validator';
import { SportType, TrainingPlanStatus } from '@prisma/client';

export class CreateTrainingPlanInput {
  @IsString()
  @IsOptional()
  startDate: string;

  @IsString()
  @IsNotEmpty()
  objective: string;

  @IsEnum(TrainingPlanStatus)
  @IsNotEmpty()
  status: TrainingPlanStatus;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsArray()
  @IsEnum(SportType, { each: true })
  sports: SportType[];

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;
}
