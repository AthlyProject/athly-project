import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CompleteWorkoutDto {
  @ApiPropertyOptional({ description: 'UUID of the HKWorkout that executed this prescribed workout' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  appleHealthWorkoutUUID?: string;

  @ApiPropertyOptional({ description: 'Actual distance covered in meters (from the linked HK session)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDistanceMeters?: number;

  @ApiPropertyOptional({ description: 'Actual duration in seconds (from the linked HK session)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDurationSeconds?: number;
}
