import { IsOptional, IsString, IsObject, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { SportType } from '@prisma/client';

export class UpdateTrainingPlanInput {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsObject()
  weeks?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsEnum(SportType)
  sports: SportType[];

  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;
}
