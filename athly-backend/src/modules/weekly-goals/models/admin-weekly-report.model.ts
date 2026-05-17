import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminPromptLogModel {
  @ApiProperty()
  promptText: string;

  @ApiProperty()
  rawResponse: string;

  @ApiPropertyOptional()
  parsedResponse?: Record<string, unknown> | null;

  @ApiProperty()
  modelUsed: string;

  @ApiProperty()
  promptVersion: string;

  @ApiProperty()
  generationType: string;

  @ApiProperty()
  createdAt: Date;
}

export class AdminWorkoutSummaryModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  dateScheduled: Date;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  actualDistanceMeters?: number | null;

  @ApiPropertyOptional()
  actualDurationSeconds?: number | null;
}

export class AdminWeeklyReportModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  weekStartDate: Date;

  @ApiProperty()
  weekEndDate: Date;

  @ApiPropertyOptional()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional()
  previousWeekAnalysis?: Record<string, unknown>;

  @ApiPropertyOptional({ type: AdminPromptLogModel })
  promptLog?: AdminPromptLogModel | null;

  @ApiProperty({ type: AdminWorkoutSummaryModel, isArray: true })
  workouts: AdminWorkoutSummaryModel[];
}
