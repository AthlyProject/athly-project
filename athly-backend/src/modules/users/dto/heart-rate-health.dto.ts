import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class HeartRateHealthDto {
  @ApiProperty({ minimum: 20, maximum: 150 })
  @IsInt()
  @Min(20)
  @Max(150)
  restingHeartRate: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  measuredAt: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  capturedAt: string;
}
