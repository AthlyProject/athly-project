import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PlanFromHealthDto } from './plan-from-health.dto';

export class PlannerHealthContextDto extends PlanFromHealthDto {
  @ApiProperty({ example: 'America/Sao_Paulo' })
  @IsString()
  timeZone: string;

  @ApiProperty()
  @IsDateString()
  capturedAt: string;
}

export class WorkoutPlanningContextDto {
  @ApiPropertyOptional({ type: () => PlannerHealthContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlannerHealthContextDto)
  planningContext?: PlannerHealthContextDto;
}

export class ResumePlanDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  retryFailed?: boolean;
}
