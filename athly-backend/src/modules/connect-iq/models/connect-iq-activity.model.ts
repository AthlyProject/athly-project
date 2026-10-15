import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resposta ao cabeçalho: blocos que o backend já tem, para o relógio retomar de onde parou. */
export class ConnectIqActivityUploadModel {
  @ApiProperty({ type: Number, isArray: true })
  received: number[];
  @ApiProperty({ description: 'Todos os blocos chegaram (ou o atleta já resolveu a corrida)' })
  complete: boolean;
}

export class ConnectIqActivitySummaryModel {
  @ApiProperty()
  id: string;
  @ApiProperty()
  startedAt: string;
  @ApiProperty()
  endedAt: string;
  @ApiProperty({ description: 'Fuso do relógio na hora da corrida' })
  utcOffsetSec: number;
  @ApiProperty()
  distanceMeters: number;
  @ApiProperty({ description: 'Tempo com o cronômetro rodando' })
  timerSeconds: number;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avgHeartRate: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  maxHeartRate: number | null;
}

export class ConnectIqActivityLapModel {
  @ApiProperty()
  index: number;
  @ApiProperty()
  startedAt: string;
  @ApiProperty()
  endedAt: string;
  @ApiProperty()
  distanceMeters: number;
  @ApiProperty()
  timerSeconds: number;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avgHeartRate: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  maxHeartRate: number | null;
  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Activity.WorkoutIntensity do passo; null numa volta sem treino',
  })
  intensity: number | null;
}

export class ConnectIqActivityPauseModel {
  @ApiProperty()
  startedAt: string;
  @ApiProperty()
  endedAt: string;
}

export class ConnectIqActivityDetailModel extends ConnectIqActivitySummaryModel {
  @ApiProperty({ type: () => ConnectIqActivityLapModel, isArray: true })
  laps: ConnectIqActivityLapModel[];
  @ApiProperty({ type: () => ConnectIqActivityPauseModel, isArray: true })
  pauses: ConnectIqActivityPauseModel[];
  @ApiProperty({
    description: 'Rota: [segundos desde o início, latitude, longitude, FC em bpm (0 = sem FC)]',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  points: number[][];
}
