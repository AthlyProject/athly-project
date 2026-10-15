import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Corridas de até 48 h; acima disso é lixo ou atividade esquecida ligada. */
export const MAX_ACTIVITY_SECONDS = 48 * 3600;
export const MAX_ACTIVITY_PARTS = 200;
/** Bloco binário da rota (antes do base64). O relógio manda ~6,5 KB. */
export const MAX_PART_BYTES = 16 * 1024;

/**
 * Volta gravada pelo campo de dados. Num treino da Athly é um passo do player nativo; numa
 * corrida livre, uma volta (botão ou automática). Tempos em segundos desde o início.
 */
export class ConnectIqLapDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVITY_PARTS * 10)
  index: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVITY_SECONDS)
  start: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVITY_SECONDS)
  end: number;

  @ApiProperty({ description: 'Metros' })
  @IsNumber()
  @Min(0)
  @Max(500_000)
  distance: number;

  @ApiProperty({ description: 'Segundos com o cronômetro rodando' })
  @IsNumber()
  @Min(0)
  @Max(MAX_ACTIVITY_SECONDS)
  timer: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  hrAvg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  hrMax?: number;

  @ApiPropertyOptional({
    description:
      'Activity.WorkoutIntensity do passo (0 ativo, 1 descanso, 2 aquecimento, 3 desaquecimento, 4 recuperação, 5 intervalo); ausente numa volta sem treino',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  intensity?: number;
}

/** Cabeçalho da corrida, enviado antes dos blocos da rota (e reenviado sem problema). */
export class ConnectIqActivityHeaderDto {
  @ApiProperty({ example: '1792152000', description: 'Id gerado no relógio (início em s Unix)' })
  @IsString()
  @Matches(/^[0-9a-z]{1,32}$/)
  id: string;

  @ApiProperty({ description: 'Início em segundos Unix' })
  @IsInt()
  @Min(0)
  start: number;

  @ApiProperty({ description: 'Fim em segundos Unix' })
  @IsInt()
  @Min(0)
  end: number;

  @ApiProperty({
    description: 'Fuso do relógio em segundos (System.getClockTime().timeZoneOffset)',
  })
  @IsInt()
  @Min(-14 * 3600)
  @Max(14 * 3600)
  utcOffset: number;

  @ApiProperty({ description: 'Metros (Activity.Info.elapsedDistance)' })
  @IsNumber()
  @Min(0)
  @Max(500_000)
  distance: number;

  @ApiProperty({ description: 'Segundos com o cronômetro rodando (Activity.Info.timerTime)' })
  @IsNumber()
  @Min(0)
  @Max(MAX_ACTIVITY_SECONDS)
  timer: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  hrAvg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  hrMax?: number;

  @ApiProperty({ description: 'Quantos blocos de rota vêm depois (0 = sem GPS)' })
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVITY_PARTS)
  parts: number;

  @ApiProperty({ type: () => ConnectIqLapDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_ACTIVITY_PARTS)
  @ValidateNested({ each: true })
  @Type(() => ConnectIqLapDto)
  laps: ConnectIqLapDto[];

  @ApiProperty({
    type: Number,
    isArray: true,
    description: 'Pausas achatadas: [início1, fim1, início2, fim2, ...] em segundos desde o início',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MAX_ACTIVITY_SECONDS, { each: true })
  pauses: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  appVersion?: string;
}

export class ConnectIqActivityPartDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(MAX_ACTIVITY_PARTS - 1)
  seq: number;

  @ApiProperty({ description: 'Bloco da rota em base64 (pontos de 13 bytes)' })
  @IsString()
  @MaxLength(Math.ceil(MAX_PART_BYTES / 3) * 4)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  data: string;
}

export const ACTIVITY_RESOLUTIONS = ['linked', 'free_run', 'dismissed'] as const;
export type ActivityResolution = (typeof ACTIVITY_RESOLUTIONS)[number];

/** Decisão do atleta no app sobre a corrida recebida do relógio. */
export class ResolveConnectIqActivityDto {
  @ApiProperty({ enum: ACTIVITY_RESOLUTIONS })
  @IsIn(ACTIVITY_RESOLUTIONS)
  resolution: ActivityResolution;

  @ApiPropertyOptional({ description: 'Treino vinculado (obrigatório quando `linked`)' })
  @ValidateIf((dto: ResolveConnectIqActivityDto) => dto.resolution === 'linked')
  @IsUUID()
  workoutId?: string;
}
