import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectIqPairingModel {
  @ApiProperty({ example: '48213907' })
  code: string;
  @ApiProperty({ description: 'Segredo para consultar o pareamento; nunca vai na URL' })
  pollToken: string;
  @ApiProperty()
  expiresInSec: number;
  @ApiProperty()
  pollIntervalSec: number;
}

export class ConnectIqPollModel {
  @ApiProperty({ enum: ['pending', 'paired', 'expired'] })
  status: 'pending' | 'paired' | 'expired';
  @ApiPropertyOptional({ description: 'Só com status `paired`; entregue uma única vez' })
  deviceToken?: string;
  @ApiPropertyOptional()
  expiresInSec?: number;
}

export class ConnectIqLastSyncModel {
  @ApiProperty()
  downloaded: number;
  @ApiProperty()
  removed: number;
  @ApiProperty()
  failed: number;
  @ApiProperty()
  storageFull: boolean;
  @ApiProperty({ type: String, isArray: true })
  syncedIds: string[];
}

export class ConnectIqDeviceModel {
  @ApiProperty()
  id: string;
  @ApiProperty({
    enum: ['pending', 'active'],
    description: '`pending` até o relógio buscar o token e fazer a primeira chamada',
  })
  status: 'pending' | 'active';
  @ApiPropertyOptional({ type: String, nullable: true })
  partNumber: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  appVersion: string | null;
  @ApiProperty()
  pairedAt: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  lastSeenAt: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  lastSyncAt: string | null;
  @ApiPropertyOptional({ type: () => ConnectIqLastSyncModel, nullable: true })
  lastSync: ConnectIqLastSyncModel | null;
}

export class ConnectIqManifestWorkoutModel {
  @ApiProperty()
  id: string;
  @ApiProperty({ description: 'Muda quando o FIT do treino mudaria' })
  rev: string;
  @ApiProperty({ example: '2026-10-07' })
  date: string;
  @ApiProperty({ example: '07/10 Intervalado 6x400m' })
  name: string;
  @ApiProperty()
  steps: number;
}

export class ConnectIqManifestModel {
  @ApiProperty()
  v: number;
  @ApiProperty({ example: '2026-10-07' })
  today: string;
  @ApiProperty({ type: () => ConnectIqManifestWorkoutModel, isArray: true })
  workouts: ConnectIqManifestWorkoutModel[];
}
