import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CompleteWorkoutDto {
  @ApiPropertyOptional({ description: 'UUID of the HKWorkout that executed this prescribed workout' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  appleHealthWorkoutUUID?: string;
}
