import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  IsNumber,
} from 'class-validator';
import { SportType, WorkoutStatus } from '@prisma/client';

export class UpdateWorkoutInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: () => [WorkoutBlockInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutBlockInput)
  blocks?: WorkoutBlockInput[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  intensity?: number;

  @ApiPropertyOptional({ enum: WorkoutStatus })
  @IsOptional()
  @IsEnum(WorkoutStatus)
  status?: WorkoutStatus;

  @ApiPropertyOptional({ enum: SportType })
  @IsOptional()
  @IsEnum(SportType)
  sportType?: SportType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;
}

export class WorkoutBlockInput {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  distance?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetPace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}
