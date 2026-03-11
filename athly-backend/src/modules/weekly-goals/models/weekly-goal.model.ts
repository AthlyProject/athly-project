import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeeklyGoalStatus } from '@prisma/client';

export class WeeklyGoalModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  trainingPlanId: string;

  @ApiProperty()
  weekStartDate: Date;

  @ApiProperty()
  weekEndDate: Date;

  @ApiProperty({ enum: WeeklyGoalStatus })
  status: WeeklyGoalStatus;

  @ApiPropertyOptional()
  metrics?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
