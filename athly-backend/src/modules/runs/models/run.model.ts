import { ApiProperty } from '@nestjs/swagger';
import { SportType } from '@prisma/client';

export class SaveRunResponseModel {
  @ApiProperty()
  id: string;
}

export class RunHistoryModel {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SportType })
  sportType: SportType;

  /** ISO 8601 do início da corrida (mantém o nome `dateScheduled` para compatibilidade com o cliente). */
  @ApiProperty()
  dateScheduled: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  distanceMeters: number;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  averagePace: number;

  @ApiProperty()
  elevationGain: number;

  @ApiProperty()
  calories: number;

  @ApiProperty()
  createdAt: string;
}
