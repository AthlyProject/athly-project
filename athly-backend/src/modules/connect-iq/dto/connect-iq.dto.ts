import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Metadados que o relógio manda ao pedir um código de pareamento. */
export class CreatePairingDto {
  @ApiPropertyOptional({ description: 'Part number do relógio (System.DeviceSettings.partNumber)' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  partNumber?: string;

  @ApiPropertyOptional({ description: 'Versão da API Connect IQ do relógio, ex. "5.2.0"' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  apiLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  appVersion?: string;

  @ApiPropertyOptional({
    description:
      'DeviceSettings.uniqueIdentifier — só o hash é guardado, para não duplicar o relógio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  uid?: string;
}

export class PollPairingDto {
  @ApiProperty()
  @IsString()
  @Length(20, 100)
  pollToken: string;
}

export class ClaimPairingDto {
  @ApiProperty({ example: '4821 3907', description: 'Código de 8 dígitos mostrado no relógio' })
  @IsString()
  @Matches(/^\d{4}[\s-]?\d{4}$/, { message: 'Código inválido' })
  code: string;
}

export class WatchDateQueryDto {
  @ApiPropertyOptional({ example: '2026-10-07', description: 'Data local do relógio' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  today?: string;
}

export class SyncFailureDto {
  @ApiPropertyOptional({ description: 'Treino que falhou; ausente quando a falha é no manifesto' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @ApiProperty({ description: 'responseCode do makeWebRequest (ou código interno do app)' })
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  code: number;
}

export class SyncReportDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  downloaded: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  removed: number;

  @ApiProperty({ type: () => SyncFailureDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SyncFailureDto)
  failures: SyncFailureDto[];

  @ApiProperty({ description: 'Treinos da Athly presentes no relógio ao fim da sincronização' })
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  syncedIds: string[];

  @ApiPropertyOptional({ description: 'O relógio recusou por falta de espaço para treinos' })
  @IsOptional()
  @IsBoolean()
  storageFull?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  appVersion?: string;
}
