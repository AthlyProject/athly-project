import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SegmentLabel {
  warmup = 'warmup',
  easy = 'easy',
  tempo = 'tempo',
  rep = 'rep',
  rec = 'rec',
  cooldown = 'cooldown',
}

export class SegmentDto {
  @ApiProperty({ enum: SegmentLabel })
  @IsEnum(SegmentLabel)
  label: SegmentLabel;

  @ApiPropertyOptional({ description: 'Rep index (1-based) when label = rep or rec' })
  @IsOptional()
  @IsInt()
  @Min(1)
  index?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  distanceKm: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @ApiPropertyOptional({ description: 'Seconds per km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgPaceSecondsPerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgHR?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  peakHR?: number;

  @ApiPropertyOptional({ description: 'HR at end of segment (useful for recovery deltas between reps)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  endHR?: number;
}

/**
 * A run captured in enough detail for the AI to evaluate intervals/tempos against prescriptions.
 * Segmentation is done on the client before upload to keep the AI prompt lean and deterministic.
 */
export class DetailedSessionDto {
  @ApiProperty({ description: 'ISO 8601 start date of the run' })
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsString()
  appleHealthWorkoutUUID: string;

  @ApiPropertyOptional({
    description:
      'Prescribed Workout.id if the client resolved the link locally (SwiftData). If omitted, backend will attempt a same-day fallback match.',
  })
  @IsOptional()
  @IsString()
  athlyWorkoutId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  distanceMeters: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePaceSecondsPerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgHR?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHR?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  activeEnergyBurned?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  elevationGainMeters?: number;

  @ApiProperty({ type: [SegmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments: SegmentDto[];

  @ApiPropertyOptional({
    description:
      'Origin of the segments: events (laps), prescribed (Athly plan sliced against HealthKit), route (real GPS), or synthetic (avg-pace fallback).',
    enum: ['events', 'prescribed', 'prescribed_low_confidence', 'route', 'synthetic'],
  })
  @IsOptional()
  @IsString()
  splitsSource?: string;
}

export class HealthRunItemDto {
  @ApiProperty({ description: 'ISO 8601 start date of the run' })
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  distanceMeters: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePaceSecondsPerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  activeEnergyBurned?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  elevationGainMeters?: number;
}

export class PlanFromHealthDto {
  @ApiProperty({
    type: [HealthRunItemDto],
    description:
      'Lightweight aggregated runs for historical context (up to 20 on first generation). May be empty for a cold start with no run history → assessment plan.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthRunItemDto)
  runs: HealthRunItemDto[];

  @ApiPropertyOptional({
    type: [DetailedSessionDto],
    description:
      'Rich per-segment sessions for execution analysis (5 on first generation, 7 mid-plan). Optional for backward compatibility.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailedSessionDto)
  detailedSessions?: DetailedSessionDto[];

  @ApiPropertyOptional({
    description:
      'Week start date (YYYY-MM-DD). Defaults to the current week from today onward; if no available training day remains, uses next Monday.',
  })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;
}
