import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SportType } from '@prisma/client';

export class TrainingPlanModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startDate: string;

  @ApiProperty()
  objective: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  targetDate: Date | null;

  @ApiProperty({ enum: SportType, isArray: true })
  sports: SportType[];

  @ApiProperty()
  autoGenerate: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
