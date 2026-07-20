import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Min, ValidateNested } from 'class-validator';
import { DetailedSessionDto } from '../../ai-planner/dto/plan-from-health.dto';

export class CompleteWorkoutDto {
  @ApiPropertyOptional({
    description: 'UUID of the HKWorkout that executed this prescribed workout',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  appleHealthWorkoutUUID?: string;

  @ApiPropertyOptional({
    description: 'Actual distance covered in meters (from the linked HK session)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDistanceMeters?: number;

  @ApiPropertyOptional({ description: 'Actual duration in seconds (from the linked HK session)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDurationSeconds?: number;

  @ApiPropertyOptional({
    type: () => DetailedSessionDto,
    description:
      'Detailed execution reconstructed from the linked HKWorkout and Athly prescription',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DetailedSessionDto)
  executionDetails?: DetailedSessionDto;
}
