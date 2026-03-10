import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PlanNextWeekInput {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  numberOfRuns?: number;

  @IsOptional()
  @IsDateString()
  weekStartDate?: string;
}
