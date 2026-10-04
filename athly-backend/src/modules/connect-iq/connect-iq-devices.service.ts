import { Injectable, Logger } from '@nestjs/common';
import { ConnectIqDevice, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SyncReportDto } from './dto/connect-iq.dto';
import { ConnectIqDeviceModel, ConnectIqLastSyncModel } from './models/connect-iq.model';
import { DEVICE_TOKEN_PREFIX, sha256 } from './utils/secrets';

/** Relógio autenticado pelo token, anexado à request pelo `DeviceTokenGuard`. */
export interface CiqDeviceContext {
  id: string;
  userId: string;
  partNumber: string | null;
}

/** `lastSeenAt` só é regravado depois deste intervalo — evita um UPDATE por request. */
const LAST_SEEN_THROTTLE_MS = 5 * 60_000;

export function toDeviceModel(device: ConnectIqDevice): ConnectIqDeviceModel {
  return {
    id: device.id,
    status: device.activatedAt ? 'active' : 'pending',
    partNumber: device.partNumber,
    appVersion: device.appVersion,
    pairedAt: device.pairedAt.toISOString(),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    lastSyncAt: device.lastSyncAt?.toISOString() ?? null,
    lastSync: (device.lastSyncReport as ConnectIqLastSyncModel | null) ?? null,
  };
}

@Injectable()
export class ConnectIqDevicesService {
  private readonly logger = new Logger(ConnectIqDevicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve o relógio pelo token. Na primeira chamada autenticada o relógio é ativado: fecha o
   * pareamento e apaga pareamentos anteriores do mesmo relógio físico para o mesmo usuário.
   */
  async authenticate(token: string, now = new Date()): Promise<CiqDeviceContext | null> {
    if (!token.startsWith(DEVICE_TOKEN_PREFIX)) return null;
    const device = await this.prisma.connectIqDevice.findUnique({
      where: { tokenHash: sha256(token) },
      select: {
        id: true,
        userId: true,
        partNumber: true,
        activatedAt: true,
        lastSeenAt: true,
        hardwareIdHash: true,
      },
    });
    if (!device) return null;

    if (!device.activatedAt) {
      await this.activate(device, now);
    } else if (
      !device.lastSeenAt ||
      now.getTime() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS
    ) {
      this.prisma.connectIqDevice
        .updateMany({ where: { id: device.id }, data: { lastSeenAt: now } })
        .catch((error: unknown) =>
          this.logger.warn(`lastSeenAt não atualizado: ${(error as Error).message}`),
        );
    }
    return { id: device.id, userId: device.userId, partNumber: device.partNumber };
  }

  async list(userId: string): Promise<ConnectIqDeviceModel[]> {
    const devices = await this.prisma.connectIqDevice.findMany({
      where: { userId },
      orderBy: { pairedAt: 'desc' },
    });
    return devices.map(toDeviceModel);
  }

  /** Idempotente: desparear um relógio que já não existe não é erro. */
  async unpair(userId: string, deviceId: string): Promise<void> {
    await this.prisma.connectIqDevice.deleteMany({ where: { id: deviceId, userId } });
  }

  async recordSyncReport(
    device: CiqDeviceContext,
    report: SyncReportDto,
    now = new Date(),
  ): Promise<void> {
    const lastSync: ConnectIqLastSyncModel = {
      downloaded: report.downloaded,
      removed: report.removed,
      failed: report.failures.length,
      storageFull: report.storageFull ?? false,
      syncedIds: report.syncedIds,
    };
    await this.prisma.connectIqDevice.updateMany({
      where: { id: device.id },
      data: {
        lastSyncAt: now,
        lastSeenAt: now,
        lastSyncReport: lastSync as unknown as Prisma.InputJsonValue,
        ...(report.appVersion ? { appVersion: report.appVersion } : {}),
      },
    });
    const { syncedIds, ...counts } = lastSync;
    this.logger.log(
      JSON.stringify({
        event: 'ciq_sync_report',
        deviceId: device.id,
        userId: device.userId,
        partNumber: device.partNumber,
        ...counts,
        synced: syncedIds.length,
        failures: report.failures,
        appVersion: report.appVersion ?? null,
      }),
    );
  }

  private async activate(
    device: { id: string; userId: string; hardwareIdHash: string | null },
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.connectIqDevice.update({
        where: { id: device.id },
        data: { activatedAt: now, lastSeenAt: now },
      }),
      this.prisma.connectIqPairing.updateMany({
        where: { deviceId: device.id, consumedAt: null },
        data: { consumedAt: now },
      }),
      // O mesmo relógio pareado de novo substitui o registro antigo em vez de duplicar.
      ...(device.hardwareIdHash
        ? [
            this.prisma.connectIqDevice.deleteMany({
              where: {
                userId: device.userId,
                hardwareIdHash: device.hardwareIdHash,
                id: { not: device.id },
              },
            }),
          ]
        : []),
    ]);
  }
}
