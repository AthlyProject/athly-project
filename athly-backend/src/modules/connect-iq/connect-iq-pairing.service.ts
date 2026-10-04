import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CodedBadRequestException,
  CodedConflictException,
  CodedServiceUnavailableException,
  CodedTooManyRequestsException,
} from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { toDeviceModel } from './connect-iq-devices.service';
import { CreatePairingDto } from './dto/connect-iq.dto';
import {
  ConnectIqDeviceModel,
  ConnectIqPairingModel,
  ConnectIqPollModel,
} from './models/connect-iq.model';
import { FixedWindowRateLimiter } from './utils/rate-limiter';
import {
  generateDeviceToken,
  generatePairingCode,
  generatePollToken,
  normalizePairingCode,
  PAIRING_CODE_LENGTH,
  sha256,
} from './utils/secrets';

export const PAIRING_TTL_MS = 10 * 60_000;
export const POLL_INTERVAL_SEC = 5;
/** Teto de códigos vivos e não usados — limita quanto um cliente anônimo consegue criar. */
export const MAX_LIVE_PAIRINGS = 500;
export const MAX_DEVICES_PER_USER = 5;
const CLAIM_ATTEMPTS = 10;
const CLAIM_WINDOW_MS = 15 * 60_000;
/** Pareamentos expirados ficam 1 h (o relógio ainda pode buscar o token de um código usado). */
const PAIRING_RETENTION_MS = 60 * 60_000;
/** Relógio confirmado no iPhone que nunca buscou o token. */
const UNACTIVATED_DEVICE_TTL_MS = 24 * 60 * 60_000;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

@Injectable()
export class ConnectIqPairingService {
  private readonly claimLimiter = new FixedWindowRateLimiter(CLAIM_ATTEMPTS, CLAIM_WINDOW_MS);

  constructor(private readonly prisma: PrismaService) {}

  /** Chamado pelo relógio (sem autenticação): devolve o código a mostrar e o segredo do poll. */
  async createPairing(input: CreatePairingDto, now = new Date()): Promise<ConnectIqPairingModel> {
    await this.cleanup(now);
    const live = await this.prisma.connectIqPairing.count({
      where: { claimedAt: null, expiresAt: { gt: now } },
    });
    if (live >= MAX_LIVE_PAIRINGS) {
      throw new CodedServiceUnavailableException(
        ErrorCode.CIQ_PAIRING_UNAVAILABLE,
        'Pareamento indisponível no momento. Tente de novo em alguns minutos.',
      );
    }

    const pollToken = generatePollToken();
    const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
    for (let attempt = 1; ; attempt++) {
      const code = generatePairingCode();
      try {
        await this.prisma.connectIqPairing.create({
          data: {
            codeHash: sha256(code),
            pollTokenHash: sha256(pollToken),
            hardwareIdHash: input.uid ? sha256(input.uid) : null,
            partNumber: input.partNumber ?? null,
            apiLevel: input.apiLevel ?? null,
            appVersion: input.appVersion ?? null,
            expiresAt,
          },
        });
        return {
          code,
          pollToken,
          expiresInSec: PAIRING_TTL_MS / 1000,
          pollIntervalSec: POLL_INTERVAL_SEC,
        };
      } catch (error) {
        // Colisão de código (10⁸ combinações): sorteia outro.
        if (!isUniqueViolation(error) || attempt >= 3) throw error;
      }
    }
  }

  /** Chamado pelo relógio enquanto mostra o código; entrega o token uma vez confirmado no app. */
  async poll(pollToken: string, now = new Date()): Promise<ConnectIqPollModel> {
    const pairing = await this.prisma.connectIqPairing.findUnique({
      where: { pollTokenHash: sha256(pollToken) },
    });
    if (!pairing || pairing.consumedAt) return { status: 'expired' };
    if (!pairing.claimedAt || !pairing.deviceId) {
      if (pairing.expiresAt <= now) return { status: 'expired' };
      return {
        status: 'pending',
        expiresInSec: Math.ceil((pairing.expiresAt.getTime() - now.getTime()) / 1000),
      };
    }

    // Cada poll antes do primeiro uso gera um token novo e invalida o anterior: se a resposta se
    // perder no Bluetooth, o relógio pede de novo e continua existindo um único token válido.
    const deviceToken = generateDeviceToken();
    const issued = await this.prisma.connectIqDevice.updateMany({
      where: { id: pairing.deviceId, activatedAt: null },
      data: { tokenHash: sha256(deviceToken), tokenIssuedAt: now },
    });
    if (issued.count !== 1) return { status: 'expired' };
    return { status: 'paired', deviceToken };
  }

  /** Chamado pelo app (usuário logado) com o código digitado. */
  async claim(userId: string, rawCode: string, now = new Date()): Promise<ConnectIqDeviceModel> {
    if (!this.claimLimiter.tryConsume(userId)) {
      throw new CodedTooManyRequestsException(
        ErrorCode.CIQ_PAIRING_RATE_LIMITED,
        'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      );
    }
    const invalid = () =>
      new CodedBadRequestException(
        ErrorCode.CIQ_PAIRING_CODE_INVALID,
        'Código inválido ou expirado. Confira o código no relógio.',
      );
    const code = normalizePairingCode(rawCode);
    if (code.length !== PAIRING_CODE_LENGTH) throw invalid();

    return this.prisma.$transaction(async (tx) => {
      const pairing = await tx.connectIqPairing.findUnique({ where: { codeHash: sha256(code) } });
      if (!pairing || pairing.claimedAt || pairing.expiresAt <= now) throw invalid();

      // Re-parear o mesmo relógio não conta para o limite: o registro antigo some na ativação.
      const devices = await tx.connectIqDevice.count({
        where: {
          userId,
          ...(pairing.hardwareIdHash
            ? {
                OR: [{ hardwareIdHash: null }, { hardwareIdHash: { not: pairing.hardwareIdHash } }],
              }
            : {}),
        },
      });
      if (devices >= MAX_DEVICES_PER_USER) {
        throw new CodedConflictException(
          ErrorCode.CIQ_DEVICE_LIMIT_REACHED,
          `Você já tem ${MAX_DEVICES_PER_USER} relógios conectados. Desconecte um para continuar.`,
        );
      }

      const claimed = await tx.connectIqPairing.updateMany({
        where: { id: pairing.id, claimedAt: null, expiresAt: { gt: now } },
        data: { claimedAt: now, claimedByUserId: userId },
      });
      if (claimed.count !== 1) throw invalid();

      const device = await tx.connectIqDevice.create({
        data: {
          userId,
          hardwareIdHash: pairing.hardwareIdHash,
          partNumber: pairing.partNumber,
          apiLevel: pairing.apiLevel,
          appVersion: pairing.appVersion,
          pairedAt: now,
        },
      });
      await tx.connectIqPairing.update({
        where: { id: pairing.id },
        data: { deviceId: device.id },
      });
      return toDeviceModel(device);
    });
  }

  private async cleanup(now: Date): Promise<void> {
    await this.prisma.connectIqPairing.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - PAIRING_RETENTION_MS) } },
    });
    await this.prisma.connectIqDevice.deleteMany({
      where: {
        activatedAt: null,
        pairedAt: { lt: new Date(now.getTime() - UNACTIVATED_DEVICE_TTL_MS) },
      },
    });
  }
}
