import { Injectable, Logger } from '@nestjs/common';
import { ConnectIqActivity, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CodedBadRequestException,
  CodedNotFoundException,
} from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { decodeTrack, isValidTrackBlock } from './activity/track-codec';
import type { CiqDeviceContext } from './connect-iq-devices.service';
import {
  ConnectIqActivityHeaderDto,
  ConnectIqActivityPartDto,
  ConnectIqLapDto,
  MAX_ACTIVITY_SECONDS,
  MAX_PART_BYTES,
  ResolveConnectIqActivityDto,
} from './dto/connect-iq-activity.dto';
import {
  ConnectIqActivityDetailModel,
  ConnectIqActivitySummaryModel,
  ConnectIqActivityUploadModel,
} from './models/connect-iq-activity.model';

/** A rota GPS é dado sensível: some 30 dias depois de chegar, resolvida ou não. */
export const ACTIVITY_RETENTION_MS = 30 * 24 * 3600_000;
/** O app só pergunta sobre corridas recentes — mesma ideia da detecção do Apple Health. */
export const PENDING_WINDOW_MS = 7 * 24 * 3600_000;
const MAX_PENDING = 10;
/** Relógio com o relógio interno adiantado ou corrida antiga demais para valer a pena. */
const MAX_FUTURE_SKEW_MS = 24 * 3600_000;

type StoredLap = Pick<
  ConnectIqLapDto,
  'index' | 'start' | 'end' | 'distance' | 'timer' | 'hrAvg' | 'hrMax' | 'intensity'
>;

const invalid = (message: string) =>
  new CodedBadRequestException(ErrorCode.CIQ_ACTIVITY_INVALID, message);
const notFound = () =>
  new CodedNotFoundException(ErrorCode.CIQ_ACTIVITY_NOT_FOUND, 'Corrida não encontrada.');

const seconds = (date: Date, offsetSec: number) =>
  new Date(date.getTime() + offsetSec * 1000).toISOString();

/** [i1, f1, i2, f2, ...] → [[i1, f1], ...], descartando pares incompletos ou invertidos. */
export function pausePairs(flat: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (flat[i + 1] > flat[i]) pairs.push([flat[i], flat[i + 1]]);
  }
  return pairs;
}

function toSummary(activity: ConnectIqActivity): ConnectIqActivitySummaryModel {
  return {
    id: activity.id,
    startedAt: activity.startedAt.toISOString(),
    endedAt: activity.endedAt.toISOString(),
    utcOffsetSec: activity.utcOffsetSec,
    distanceMeters: activity.distanceMeters,
    timerSeconds: activity.timerSeconds,
    avgHeartRate: activity.avgHeartRate,
    maxHeartRate: activity.maxHeartRate,
    plannedWorkoutId: activity.plannedWorkoutId,
  };
}

/**
 * Corridas gravadas pelo campo de dados da Athly. O relógio manda o cabeçalho e depois os blocos
 * da rota, um por request (o processo em segundo plano do relógio tem 64 KB). Quando tudo chega,
 * a corrida fica `ready` e o app pergunta ao atleta o que fazer — o backend nunca conclui treino
 * sozinho.
 */
@Injectable()
export class ConnectIqActivitiesService {
  private readonly logger = new Logger(ConnectIqActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Idempotente: o relógio reenvia o cabeçalho sempre que retoma um envio interrompido. */
  async receiveHeader(
    device: CiqDeviceContext,
    header: ConnectIqActivityHeaderDto,
    now = new Date(),
  ): Promise<ConnectIqActivityUploadModel> {
    this.assertPlausible(header, now);
    await this.purgeExpired(device.userId, now);

    const existing = await this.prisma.connectIqActivity.findUnique({
      where: { userId_clientId: { userId: device.userId, clientId: header.id } },
      select: { id: true, status: true, partCount: true },
    });
    if (existing && existing.status !== 'receiving') {
      return { received: [...Array(existing.partCount).keys()], complete: true };
    }

    const data = {
      startedAt: new Date(header.start * 1000),
      endedAt: new Date(header.end * 1000),
      utcOffsetSec: header.utcOffset,
      distanceMeters: header.distance,
      timerSeconds: header.timer,
      avgHeartRate: header.hrAvg ?? null,
      maxHeartRate: header.hrMax ?? null,
      laps: header.laps.map(
        (lap): StoredLap => ({
          index: lap.index,
          start: lap.start,
          end: lap.end,
          distance: lap.distance,
          timer: lap.timer,
          hrAvg: lap.hrAvg,
          hrMax: lap.hrMax,
          intensity: lap.intensity,
        }),
      ) as unknown as Prisma.InputJsonValue,
      pauses: pausePairs(header.pauses) as unknown as Prisma.InputJsonValue,
      partCount: header.parts,
      plannedWorkoutId: header.workoutId ?? null,
      ...(header.parts === 0 ? { status: 'ready' as const } : {}),
    };
    const activity = await this.prisma.connectIqActivity.upsert({
      where: { userId_clientId: { userId: device.userId, clientId: header.id } },
      create: { ...data, userId: device.userId, deviceId: device.id, clientId: header.id },
      update: data,
      select: { id: true, status: true },
    });
    // O relógio pode ter refeito a rota com menos blocos: os que sobram não valem mais.
    await this.prisma.connectIqActivityPart.deleteMany({
      where: { activityId: activity.id, seq: { gte: header.parts } },
    });
    const parts = await this.prisma.connectIqActivityPart.findMany({
      where: { activityId: activity.id },
      select: { seq: true },
      orderBy: { seq: 'asc' },
    });
    const received = parts.map((part) => part.seq);
    const complete = await this.markReadyIfComplete(activity.id, received.length, header.parts);

    this.logger.log(
      JSON.stringify({
        event: 'ciq_activity_header',
        userId: device.userId,
        deviceId: device.id,
        partNumber: device.partNumber,
        parts: header.parts,
        received: received.length,
        laps: header.laps.length,
        appVersion: header.appVersion ?? null,
      }),
    );
    return { received, complete: complete || activity.status === 'ready' };
  }

  async receivePart(
    device: CiqDeviceContext,
    clientId: string,
    part: ConnectIqActivityPartDto,
  ): Promise<ConnectIqActivityUploadModel> {
    const activity = await this.prisma.connectIqActivity.findUnique({
      where: { userId_clientId: { userId: device.userId, clientId } },
      select: { id: true, status: true, partCount: true },
    });
    if (!activity) throw notFound();
    if (activity.status !== 'receiving') {
      return { received: [...Array(activity.partCount).keys()], complete: true };
    }
    if (part.seq >= activity.partCount) throw invalid('Bloco fora da corrida.');

    const data = Buffer.from(part.data, 'base64');
    if (!isValidTrackBlock(data, MAX_PART_BYTES)) throw invalid('Bloco de rota inválido.');

    await this.prisma.connectIqActivityPart.upsert({
      where: { activityId_seq: { activityId: activity.id, seq: part.seq } },
      create: { activityId: activity.id, seq: part.seq, data: new Uint8Array(data) },
      update: { data: new Uint8Array(data) },
    });
    const parts = await this.prisma.connectIqActivityPart.findMany({
      where: { activityId: activity.id },
      select: { seq: true },
      orderBy: { seq: 'asc' },
    });
    const received = parts.map((p) => p.seq);
    const complete = await this.markReadyIfComplete(
      activity.id,
      received.length,
      activity.partCount,
    );
    return { received, complete };
  }

  /** Corridas completas que o atleta ainda não resolveu, mais recentes primeiro. */
  async listPending(userId: string, now = new Date()): Promise<ConnectIqActivitySummaryModel[]> {
    const activities = await this.prisma.connectIqActivity.findMany({
      where: {
        userId,
        status: 'ready',
        startedAt: { gte: new Date(now.getTime() - PENDING_WINDOW_MS) },
      },
      orderBy: { startedAt: 'desc' },
      take: MAX_PENDING,
    });
    return activities.map(toSummary);
  }

  async detail(userId: string, id: string): Promise<ConnectIqActivityDetailModel> {
    const activity = await this.prisma.connectIqActivity.findFirst({
      where: { id, userId },
      include: { parts: { orderBy: { seq: 'asc' } } },
    });
    if (!activity) throw notFound();

    const points: number[][] = [];
    for (const part of activity.parts) {
      for (const point of decodeTrack(Buffer.from(part.data))) {
        points.push([point.offsetSec, point.latitude, point.longitude, point.heartRate ?? 0]);
      }
    }
    // Blocos chegam em ordem, mas um reenvio parcial não pode embaralhar a rota.
    points.sort((a, b) => a[0] - b[0]);

    const laps = (activity.laps as unknown as StoredLap[]).map((lap) => ({
      index: lap.index,
      startedAt: seconds(activity.startedAt, lap.start),
      endedAt: seconds(activity.startedAt, lap.end),
      distanceMeters: lap.distance,
      timerSeconds: lap.timer,
      avgHeartRate: lap.hrAvg ?? null,
      maxHeartRate: lap.hrMax ?? null,
      intensity: lap.intensity ?? null,
    }));
    const pauses = (activity.pauses as unknown as [number, number][]).map(([start, end]) => ({
      startedAt: seconds(activity.startedAt, start),
      endedAt: seconds(activity.startedAt, end),
    }));
    return { ...toSummary(activity), laps, pauses, points };
  }

  /** Idempotente: o app pode repetir a decisão se a primeira resposta se perder. */
  async resolve(userId: string, id: string, input: ResolveConnectIqActivityDto, now = new Date()) {
    const updated = await this.prisma.connectIqActivity.updateMany({
      where: { id, userId },
      data: {
        status: 'resolved',
        resolution: input.resolution,
        workoutId: input.resolution === 'linked' ? input.workoutId : null,
        resolvedAt: now,
      },
    });
    if (updated.count !== 1) throw notFound();
  }

  private assertPlausible(header: ConnectIqActivityHeaderDto, now: Date): void {
    const durationSec = header.end - header.start;
    if (durationSec <= 0 || durationSec > MAX_ACTIVITY_SECONDS) {
      throw invalid('Duração da corrida inválida.');
    }
    const startMs = header.start * 1000;
    if (startMs > now.getTime() + MAX_FUTURE_SKEW_MS) throw invalid('Corrida no futuro.');
    if (startMs < now.getTime() - ACTIVITY_RETENTION_MS) throw invalid('Corrida antiga demais.');
    if (header.laps.some((lap) => lap.end < lap.start || lap.end > durationSec + 60)) {
      throw invalid('Volta fora da corrida.');
    }
  }

  private async markReadyIfComplete(
    activityId: string,
    received: number,
    partCount: number,
  ): Promise<boolean> {
    if (received < partCount) return false;
    await this.prisma.connectIqActivity.updateMany({
      where: { id: activityId, status: 'receiving' },
      data: { status: 'ready' },
    });
    return true;
  }

  private async purgeExpired(userId: string, now: Date): Promise<void> {
    await this.prisma.connectIqActivity.deleteMany({
      where: { userId, createdAt: { lt: new Date(now.getTime() - ACTIVITY_RETENTION_MS) } },
    });
  }
}
