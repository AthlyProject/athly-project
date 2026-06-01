import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SportType } from '@prisma/client';

export class SplitInputDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  kilometer: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  durationSeconds: number;

  @ApiProperty()
  @IsNumber()
  elevationDelta: number;
}

/**
 * Espelha o `SaveRunRequest` do app iOS (apenas o path muda: /workouts → /runs).
 * Persiste uma corrida concluída com métricas + rota + splits.
 */
export class CreateRunDto {
  @ApiProperty({ enum: SportType })
  @IsEnum(SportType)
  sportType: SportType;

  /** ISO 8601 do início da corrida. */
  @ApiProperty()
  @IsString()
  dateScheduled: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  duration: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  distance: number;

  @ApiProperty()
  @IsNumber()
  elevationGain: number;

  @ApiProperty()
  @IsNumber()
  calories: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  averagePace: number;

  /** Pontos da rota: array de { lat, lng, alt, ts }. Armazenado como JSON. */
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: { type: 'number' } },
  })
  @IsArray()
  routePoints: Record<string, number>[];

  @ApiProperty({ type: () => [SplitInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitInputDto)
  splits: SplitInputDto[];
}
