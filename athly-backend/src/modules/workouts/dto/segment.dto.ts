import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { SportType } from '@prisma/client';
import type {
  EndBy,
  Segment,
  SegmentKind,
  SegmentTarget,
} from '../types/segment.types';

const SEGMENT_KINDS: SegmentKind[] = [
  'warmup',
  'work',
  'recovery',
  'cooldown',
  'rest',
  'set',
];

const END_BY_VALUES: EndBy[] = ['distanceM', 'durationSec', 'reps'];

const SWIM_STROKES = [
  'freestyle',
  'backstroke',
  'breaststroke',
  'butterfly',
  'medley',
  'kick',
  'drill',
] as const;

export class EndConditionDto {
  @ApiProperty({ enum: END_BY_VALUES })
  @IsIn(END_BY_VALUES)
  by!: EndBy;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value!: number;
}

export class RunTargetDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  paceSecPerKmMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  paceSecPerKmMax?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5)
  hrZone?: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10)
  rpe?: number;
}

export class CycleTargetDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  powerWattsMin?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  powerWattsMax?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  cadenceRpm?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5)
  hrZone?: 1 | 2 | 3 | 4 | 5;
}

export class SwimTargetDto {
  @ApiPropertyOptional({ enum: SWIM_STROKES })
  @IsOptional()
  @IsIn(SWIM_STROKES as unknown as string[])
  strokeType?: (typeof SWIM_STROKES)[number];

  @ApiPropertyOptional({ enum: [25, 50] })
  @IsOptional()
  @IsIn([25, 50])
  poolLengthM?: 25 | 50;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  targetSecPer100m?: number;
}

export class StrengthTargetDto {
  @ApiProperty() @IsString()
  exercise!: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  reps?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  loadKg?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(150)
  loadPctOf1RM?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tempoSec?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  restAfterSec?: number;
}

@ValidatorConstraint({ name: 'SegmentTreeConsistency', async: false })
export class SegmentTreeConsistency implements ValidatorConstraintInterface {
  private static readonly MAX_DEPTH = 2;

  validate(segments: unknown): boolean {
    if (!Array.isArray(segments)) return false;
    return segments.every((s) =>
      this.validateNode(s as Segment, 0, []),
    );
  }

  private validateNode(node: Segment, depth: number, errors: string[]): boolean {
    if (depth > SegmentTreeConsistency.MAX_DEPTH) {
      errors.push('depth>2');
      return false;
    }
    if (node.kind === 'set') {
      if (!node.repetitions || node.repetitions < 1) return false;
      if (!Array.isArray(node.children) || node.children.length < 1) return false;
      if (node.end !== undefined) return false;
      return node.children.every((c) => this.validateNode(c, depth + 1, errors));
    }
    if (node.end === undefined) return false;
    if (node.children !== undefined) return false;
    return true;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'segments tree is inconsistent: `set` nodes need repetitions+children and no end; non-set nodes need end and no children; max depth is 2';
  }
}

export class SegmentDto implements Segment {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty({ enum: SEGMENT_KINDS })
  @IsIn(SEGMENT_KINDS)
  kind!: SegmentKind;

  @ApiPropertyOptional() @IsOptional() @IsString()
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cue?: string;

  @ApiPropertyOptional({ type: () => EndConditionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EndConditionDto)
  end?: EndConditionDto;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  repetitions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  target?: SegmentTarget;

  @ApiPropertyOptional({ type: () => [SegmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  children?: SegmentDto[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}

export class WorkoutSegmentsDto {
  @ApiProperty({ enum: [1] })
  @IsIn([1])
  schemaVersion!: 1;

  @ApiProperty({ enum: SportType })
  @IsEnum(SportType)
  sport!: SportType;

  @ApiProperty({ type: () => [SegmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  @Validate(SegmentTreeConsistency)
  segments!: SegmentDto[];
}
