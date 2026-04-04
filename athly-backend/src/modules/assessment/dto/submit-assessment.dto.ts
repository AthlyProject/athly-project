import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhysicalActivityDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  currentActivities?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  trainingPreparedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  canRun3km?: string;

  @ApiPropertyOptional()
  @IsOptional()
  runningExperience?: string;
}

export class TrainingPlanningDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  availableDays?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  hasTargetDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  targetDate?: string;
}

export class PerformanceHealthDto {
  @ApiPropertyOptional()
  @IsOptional()
  referenceDistance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  bestTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  sleepQuality?: number;

  @ApiPropertyOptional()
  @IsOptional()
  hasChronicPain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  chronicPainDescription?: string;
}

export class ParqDto {
  @ApiPropertyOptional()
  @IsOptional()
  heartCondition?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  chestPainDuringActivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  chestPainLastMonth?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  dizzinessOrLossOfConsciousness?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  boneJointProblem?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  takingBloodPressureMeds?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  otherReasonToAvoidExercise?: boolean;
}

export class GoalsDto {
  @ApiPropertyOptional()
  @IsOptional()
  practicesRegularly?: string;

  @ApiPropertyOptional()
  @IsOptional()
  targetDistance?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  motivations?: string[];
}

export class SubmitAssessmentDto {
  @ApiProperty({ type: GoalsDto })
  @IsObject()
  goals: GoalsDto;

  @ApiProperty()
  @IsObject()
  activityHistory: PhysicalActivityDto;

  @ApiProperty()
  @IsObject()
  trainingPlanning: TrainingPlanningDto;

  @ApiProperty()
  @IsObject()
  performanceHealth: PerformanceHealthDto;

  @ApiProperty()
  @IsObject()
  parq: ParqDto;

  @ApiPropertyOptional()
  @IsOptional()
  gender?: string;

  @ApiProperty()
  @IsBoolean()
  termsAccepted: boolean;
}
