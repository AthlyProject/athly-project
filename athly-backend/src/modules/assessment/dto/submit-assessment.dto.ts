import { IsBoolean, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitAssessmentDto {
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
  /** Data civil da prova (YYYY-MM-DD). Só vale no objetivo pessoal. */
  @ApiPropertyOptional({ example: '2027-04-18' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() availableDays?: string[];

  @ApiProperty() @IsBoolean() termsAccepted: boolean;
}
