import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── v1 nested DTOs (kept as optional for backward compat) ───────────────────

export class PhysicalActivityDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() currentActivities?: string[];
  @ApiPropertyOptional() @IsOptional() trainingPreparedBy?: string;
  @ApiPropertyOptional() @IsOptional() canRun3km?: string;
  @ApiPropertyOptional() @IsOptional() runningExperience?: string;
}

export class TrainingPlanningDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() availableDays?: string[];
  @ApiPropertyOptional() @IsOptional() startDate?: string;
  @ApiPropertyOptional() @IsOptional() hasTargetDate?: string;
  @ApiPropertyOptional() @IsOptional() targetDate?: string;
}

export class PerformanceHealthDto {
  @ApiPropertyOptional() @IsOptional() referenceDistance?: string;
  @ApiPropertyOptional() @IsOptional() bestTime?: string;
  @ApiPropertyOptional() @IsOptional() sleepQuality?: number;
  @ApiPropertyOptional() @IsOptional() hasChronicPain?: string;
  @ApiPropertyOptional() @IsOptional() chronicPainDescription?: string;
}

export class ParqDto {
  @ApiPropertyOptional() @IsOptional() heartCondition?: boolean;
  @ApiPropertyOptional() @IsOptional() chestPainDuringActivity?: boolean;
  @ApiPropertyOptional() @IsOptional() chestPainLastMonth?: boolean;
  @ApiPropertyOptional() @IsOptional() dizzinessOrLossOfConsciousness?: boolean;
  @ApiPropertyOptional() @IsOptional() boneJointProblem?: boolean;
  @ApiPropertyOptional() @IsOptional() takingBloodPressureMeds?: boolean;
  @ApiPropertyOptional() @IsOptional() otherReasonToAvoidExercise?: boolean;
}

export class GoalsDto {
  @ApiPropertyOptional() @IsOptional() practicesRegularly?: string;
  @ApiPropertyOptional() @IsOptional() targetDistance?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() motivations?: string[];
}

// ─── Main DTO ────────────────────────────────────────────────────────────────

export class SubmitAssessmentDto {
  // v1 (now optional)
  @ApiPropertyOptional({ type: GoalsDto }) @IsOptional() @IsObject() goals?: GoalsDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() activityHistory?: PhysicalActivityDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() trainingPlanning?: TrainingPlanningDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() performanceHealth?: PerformanceHealthDto;
  @ApiPropertyOptional() @IsOptional() @IsObject() parq?: ParqDto;

  // v2 — top-level fields from the new onboarding flow
  @ApiPropertyOptional() @IsOptional() @IsString() gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() height?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() restingHeartRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxHeartRate?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() motivations?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() runningFrequency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fitnessLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() comfortPaceSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objectiveDistance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objectiveType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetTime?: string;

  @ApiProperty() @IsBoolean() termsAccepted: boolean;
}
