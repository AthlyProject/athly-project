import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PushDeliveryStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ApnsClientService } from './apns-client.service';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;

@Injectable()
export class PushDeliveryWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PushDeliveryWorker.name);
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apns: ApnsClientService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.drain(), 5_000);
    this.timer.unref();
    void this.drain();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async drain() {
    if (this.running || !this.apns.isConfigured) return;
    this.running = true;
    try {
      await this.prisma.pushDelivery.updateMany({
        where: {
          status: { in: [PushDeliveryStatus.PENDING, PushDeliveryStatus.PROCESSING] },
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        data: {
          status: PushDeliveryStatus.FAILED,
          error: 'Notificação expirada antes do envio',
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      while (await this.processNext()) {
        // Continua até esvaziar; updateMany faz o claim atômico entre réplicas.
      }
    } catch (error) {
      this.logger.error(
        `Falha na fila APNs: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }

  private async processNext(): Promise<boolean> {
    const now = new Date();
    const candidate = await this.prisma.pushDelivery.findFirst({
      where: {
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: PushDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
          { status: PushDeliveryStatus.PROCESSING, leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return false;
    const leaseOwner = `${this.workerId}:${candidate.id}`;
    const claimed = await this.prisma.pushDelivery.updateMany({
      where: {
        id: candidate.id,
        attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { status: PushDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
          { status: PushDeliveryStatus.PROCESSING, leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        status: PushDeliveryStatus.PROCESSING,
        attempts: { increment: 1 },
        leaseOwner,
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
      },
    });
    if (claimed.count === 0) return true;

    const delivery = await this.prisma.pushDelivery.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { device: true, generation: true },
    });
    try {
      const response = await this.apns.send(
        delivery.device.token,
        delivery.device.environment,
        {
          aps: {
            alert: {
              title: 'Semana gerada',
              body: 'Seus treinos da próxima semana já estão prontos.',
            },
            sound: 'default',
          },
          type: 'weekly_plan_generated',
          generationId: delivery.generationId,
          weeklyGoalId: delivery.generation.weeklyGoalId,
        },
        delivery.generationId,
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        await this.prisma.pushDelivery.update({
          where: { id: delivery.id },
          data: {
            status: PushDeliveryStatus.SENT,
            sentAt: new Date(),
            error: null,
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        });
      } else {
        await this.handleFailure(
          delivery.id,
          delivery.device.id,
          delivery.attempts,
          response.statusCode,
          response.reason ?? `HTTP ${response.statusCode}`,
        );
      }
    } catch (error) {
      await this.handleFailure(
        delivery.id,
        delivery.device.id,
        delivery.attempts,
        0,
        error instanceof Error ? error.message : String(error),
      );
    }
    return true;
  }

  private async handleFailure(
    deliveryId: string,
    deviceId: string,
    attempts: number,
    statusCode: number,
    reason: string,
  ) {
    const invalidToken =
      statusCode === 410 ||
      reason === 'BadDeviceToken' ||
      reason === 'Unregistered' ||
      reason === 'DeviceTokenNotForTopic';
    const retryable = !invalidToken && (statusCode === 0 || statusCode === 429 || statusCode >= 500);
    if (invalidToken) {
      await this.prisma.pushDevice.update({
        where: { id: deviceId },
        data: { disabledAt: new Date() },
      });
    }
    await this.prisma.pushDelivery.update({
      where: { id: deliveryId },
      data:
        retryable && attempts < MAX_ATTEMPTS
          ? {
              status: PushDeliveryStatus.PENDING,
              nextAttemptAt: new Date(Date.now() + Math.min(60_000 * 2 ** attempts, 15 * 60_000)),
              error: reason,
              leaseOwner: null,
              leaseExpiresAt: null,
            }
          : {
              status: PushDeliveryStatus.FAILED,
              error: reason,
              leaseOwner: null,
              leaseExpiresAt: null,
            },
    });
  }
}
