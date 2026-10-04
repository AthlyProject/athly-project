import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConnectIqPairingService, MAX_LIVE_PAIRINGS } from './connect-iq-pairing.service';
import { sha256 } from './utils/secrets';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const LATER = new Date('2026-10-04T12:10:00.000Z');

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

/** Status HTTP e `code` de uma exceção codificada, para comparar num `expect` só. */
const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const response = (error as HttpException).getResponse() as { code: string };
    return { status: (error as HttpException).getStatus(), code: response.code };
  }
  throw new Error('expected the promise to reject');
};

describe('ConnectIqPairingService', () => {
  let service: ConnectIqPairingService;
  let prisma: {
    connectIqPairing: Record<
      'deleteMany' | 'count' | 'create' | 'findUnique' | 'updateMany' | 'update',
      jest.Mock
    >;
    connectIqDevice: Record<'deleteMany' | 'updateMany' | 'count' | 'create', jest.Mock>;
    $transaction: jest.Mock;
  };

  const pairing = (overrides: Record<string, unknown> = {}) => ({
    id: 'pairing-1',
    codeHash: sha256('48213907'),
    pollTokenHash: sha256('poll-token-poll-token-poll-token'),
    hardwareIdHash: sha256('watch-uid'),
    partNumber: '006-B4432-00',
    apiLevel: '5.2.0',
    appVersion: '1.0.0',
    expiresAt: LATER,
    claimedByUserId: null,
    claimedAt: null,
    deviceId: null,
    consumedAt: null,
    createdAt: NOW,
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      connectIqPairing: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      connectIqDevice: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    service = new ConnectIqPairingService(prisma as unknown as PrismaService);
  });

  describe('createPairing', () => {
    it('devolve código de 8 dígitos e guarda só os hashes', async () => {
      const result = await service.createPairing(
        { partNumber: '006-B4432-00', apiLevel: '5.2.0', appVersion: '1.0.0', uid: 'watch-uid' },
        NOW,
      );

      expect(result).toEqual({
        code: expect.stringMatching(/^\d{8}$/),
        pollToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        expiresInSec: 600,
        pollIntervalSec: 5,
      });
      expect(prisma.connectIqPairing.create).toHaveBeenCalledWith({
        data: {
          codeHash: sha256(result.code),
          pollTokenHash: sha256(result.pollToken),
          hardwareIdHash: sha256('watch-uid'),
          partNumber: '006-B4432-00',
          apiLevel: '5.2.0',
          appVersion: '1.0.0',
          expiresAt: LATER,
        },
      });
    });

    it('sorteia outro código quando colide com um existente', async () => {
      prisma.connectIqPairing.create.mockRejectedValueOnce(uniqueViolation());

      await expect(service.createPairing({}, NOW)).resolves.toMatchObject({ expiresInSec: 600 });
      expect(prisma.connectIqPairing.create).toHaveBeenCalledTimes(2);
    });

    it('desiste depois de três colisões seguidas', async () => {
      prisma.connectIqPairing.create.mockRejectedValue(uniqueViolation());

      await expect(service.createPairing({}, NOW)).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      );
      expect(prisma.connectIqPairing.create).toHaveBeenCalledTimes(3);
    });

    it('recusa com 503 quando há códigos vivos demais', async () => {
      prisma.connectIqPairing.count.mockResolvedValue(MAX_LIVE_PAIRINGS);

      await expect(failure(service.createPairing({}, NOW))).resolves.toEqual({
        status: 503,
        code: ErrorCode.CIQ_PAIRING_UNAVAILABLE,
      });
      expect(prisma.connectIqPairing.create).not.toHaveBeenCalled();
    });

    it('limpa pareamentos velhos e relógios que nunca ativaram', async () => {
      await service.createPairing({}, NOW);

      expect(prisma.connectIqPairing.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: new Date('2026-10-04T11:00:00.000Z') } },
      });
      expect(prisma.connectIqDevice.deleteMany).toHaveBeenCalledWith({
        where: { activatedAt: null, pairedAt: { lt: new Date('2026-10-03T12:00:00.000Z') } },
      });
    });
  });

  describe('poll', () => {
    it('fica pendente até o código ser confirmado no app', async () => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(pairing());

      await expect(service.poll('poll-token-poll-token-poll-token', NOW)).resolves.toEqual({
        status: 'pending',
        expiresInSec: 600,
      });
      expect(prisma.connectIqPairing.findUnique).toHaveBeenCalledWith({
        where: { pollTokenHash: sha256('poll-token-poll-token-poll-token') },
      });
    });

    it('expira código não confirmado, desconhecido ou já consumido', async () => {
      prisma.connectIqPairing.findUnique.mockResolvedValueOnce(pairing());
      await expect(service.poll('x', LATER)).resolves.toEqual({ status: 'expired' });

      prisma.connectIqPairing.findUnique.mockResolvedValueOnce(null);
      await expect(service.poll('x', NOW)).resolves.toEqual({ status: 'expired' });

      prisma.connectIqPairing.findUnique.mockResolvedValueOnce(
        pairing({ claimedAt: NOW, deviceId: 'device-1', consumedAt: NOW }),
      );
      await expect(service.poll('x', NOW)).resolves.toEqual({ status: 'expired' });
    });

    it('entrega o token do relógio depois da confirmação, mesmo após o código vencer', async () => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(
        pairing({ claimedAt: NOW, deviceId: 'device-1' }),
      );

      const result = await service.poll('x', new Date('2026-10-04T12:15:00.000Z'));

      expect(result).toEqual({ status: 'paired', deviceToken: expect.stringMatching(/^ciq_/) });
      expect(prisma.connectIqDevice.updateMany).toHaveBeenCalledWith({
        where: { id: 'device-1', activatedAt: null },
        data: {
          tokenHash: sha256(result.deviceToken as string),
          tokenIssuedAt: new Date('2026-10-04T12:15:00.000Z'),
        },
      });
    });

    it('não reemite token para relógio já ativado', async () => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(
        pairing({ claimedAt: NOW, deviceId: 'device-1' }),
      );
      prisma.connectIqDevice.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.poll('x', NOW)).resolves.toEqual({ status: 'expired' });
    });
  });

  describe('claim', () => {
    beforeEach(() => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(pairing());
      prisma.connectIqDevice.create.mockImplementation(({ data }: { data: object }) => ({
        id: 'device-1',
        activatedAt: null,
        lastSeenAt: null,
        lastSyncAt: null,
        lastSyncReport: null,
        ...data,
      }));
    });

    it('vincula o relógio ao usuário e devolve o dispositivo pendente', async () => {
      const device = await service.claim('user-1', '4821-3907', NOW);

      expect(prisma.connectIqPairing.findUnique).toHaveBeenCalledWith({
        where: { codeHash: sha256('48213907') },
      });
      expect(prisma.connectIqPairing.updateMany).toHaveBeenCalledWith({
        where: { id: 'pairing-1', claimedAt: null, expiresAt: { gt: NOW } },
        data: { claimedAt: NOW, claimedByUserId: 'user-1' },
      });
      expect(prisma.connectIqPairing.update).toHaveBeenCalledWith({
        where: { id: 'pairing-1' },
        data: { deviceId: 'device-1' },
      });
      expect(device).toEqual({
        id: 'device-1',
        status: 'pending',
        partNumber: '006-B4432-00',
        appVersion: '1.0.0',
        pairedAt: NOW.toISOString(),
        lastSeenAt: null,
        lastSyncAt: null,
        lastSync: null,
      });
    });

    it.each([
      ['desconhecido', null],
      ['já usado', { claimedAt: NOW }],
      ['vencido', { expiresAt: NOW }],
    ])('recusa código %s com o mesmo erro', async (_label, state) => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(state ? pairing(state) : null);

      await expect(failure(service.claim('user-1', '48213907', NOW))).resolves.toEqual({
        status: 400,
        code: ErrorCode.CIQ_PAIRING_CODE_INVALID,
      });
      expect(prisma.connectIqDevice.create).not.toHaveBeenCalled();
    });

    it('perde a corrida para outro usuário que confirmou o mesmo código', async () => {
      prisma.connectIqPairing.updateMany.mockResolvedValue({ count: 0 });

      await expect(failure(service.claim('user-1', '48213907', NOW))).resolves.toEqual({
        status: 400,
        code: ErrorCode.CIQ_PAIRING_CODE_INVALID,
      });
      expect(prisma.connectIqDevice.create).not.toHaveBeenCalled();
    });

    it('limita a 5 relógios, sem contar o próprio relógio sendo pareado de novo', async () => {
      prisma.connectIqDevice.count.mockResolvedValue(5);

      await expect(failure(service.claim('user-1', '48213907', NOW))).resolves.toEqual({
        status: 409,
        code: ErrorCode.CIQ_DEVICE_LIMIT_REACHED,
      });
      expect(prisma.connectIqDevice.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          OR: [{ hardwareIdHash: null }, { hardwareIdHash: { not: sha256('watch-uid') } }],
        },
      });
    });

    it('bloqueia força bruta depois de 10 tentativas na janela', async () => {
      prisma.connectIqPairing.findUnique.mockResolvedValue(null);
      for (let attempt = 0; attempt < 10; attempt++) {
        await expect(service.claim('user-1', '00000000', NOW)).rejects.toBeDefined();
      }

      await expect(failure(service.claim('user-1', '48213907', NOW))).resolves.toEqual({
        status: 429,
        code: ErrorCode.CIQ_PAIRING_RATE_LIMITED,
      });
      // Outro usuário não é afetado.
      prisma.connectIqPairing.findUnique.mockResolvedValue(pairing());
      await expect(service.claim('user-2', '48213907', NOW)).resolves.toMatchObject({
        status: 'pending',
      });
    });
  });
});
