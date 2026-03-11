import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationType } from '@prisma/client';

export class IntegrationModel {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  connected: boolean;

  @ApiProperty({ enum: IntegrationType })
  type: IntegrationType;

  @ApiPropertyOptional({ nullable: true })
  stravaAthleteId?: string | null;
}
