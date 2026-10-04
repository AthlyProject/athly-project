import { ExecutionContext, HttpException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConnectIqDevicesService } from './connect-iq-devices.service';
import { DeviceTokenGuard } from './guards/device-token.guard';
import { sha256 } from './utils/secrets';

const NOW = new Date('2026-10-04T12:00:00.000Z');
const TOKEN = 'ciq_device-token';

describe('ConnectIqDevicesService', () => {
  let service: ConnectIqDevicesService;
  let prisma: {
    connectIqDevice: Record<
      'findUnique' | 'findMany' | 'update' | 'updateMany' | 'deleteMany',
      jest.Mock
    >;
    connectIqPairing: Record<'updateMany', jest.Mock>;
    $transaction: jest.Mock;
  };

  const stored = (overrides: Record<string, unknown> = {}) => ({
    id: 'device-1',
    userId: 'user-1',
    partNumber: '006-B4432-00',
    activatedAt: new Date('2026-10-01T00:00:00.000Z'),
    lastSeenAt: new Date('2026-10-04T11:58:00.000Z'),
    hardwareIdHash: sha256('watch-uid'),
    ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    prisma = {
      connectIqDevice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      connectIqPairing: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    service = new ConnectIqDevicesService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('authenticate', () => {
    it('busca o relógio pelo hash do token', async () => {
      prisma.connectIqDevice.findUnique.mockResolvedValue(stored());

      await expect(service.authenticate(TOKEN, NOW)).resolves.toEqual({
        id: 'device-1',
        userId: 'user-1',
        partNumber: '006-B4432-00',
      });
      expect(prisma.connectIqDevice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: sha256(TOKEN) } }),
      );
      // Visto há 2 min: não regrava lastSeenAt.
      expect(prisma.connectIqDevice.updateMany).not.toHaveBeenCalled();
    });

    it('recusa token sem o prefixo do relógio sem ir ao banco', async () => {
      await expect(service.authenticate('eyJhbGciOi.jwt', NOW)).resolves.toBeNull();
      expect(prisma.connectIqDevice.findUnique).not.toHaveBeenCalled();
    });

    it('recusa token desconhecido (desconectado no app)', async () => {
      prisma.connectIqDevice.findUnique.mockResolvedValue(null);
      await expect(service.authenticate(TOKEN, NOW)).resolves.toBeNull();
    });

    it('ativa na primeira chamada: fecha o pareamento e remove o registro antigo do mesmo relógio', async () => {
      prisma.connectIqDevice.findUnique.mockResolvedValue(stored({ activatedAt: null }));

      await service.authenticate(TOKEN, NOW);

      expect(prisma.connectIqDevice.update).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { activatedAt: NOW, lastSeenAt: NOW },
      });
      expect(prisma.connectIqPairing.updateMany).toHaveBeenCalledWith({
        where: { deviceId: 'device-1', consumedAt: null },
        data: { consumedAt: NOW },
      });
      expect(prisma.connectIqDevice.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', hardwareIdHash: sha256('watch-uid'), id: { not: 'device-1' } },
      });
    });

    it('atualiza lastSeenAt quando a última visita tem mais de 5 minutos', async () => {
      prisma.connectIqDevice.findUnique.mockResolvedValue(
        stored({ lastSeenAt: new Date('2026-10-04T11:50:00.000Z') }),
      );

      await service.authenticate(TOKEN, NOW);

      expect(prisma.connectIqDevice.updateMany).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        data: { lastSeenAt: NOW },
      });
    });
  });

  it('lista os relógios com status e último relatório', async () => {
    prisma.connectIqDevice.findMany.mockResolvedValue([
      {
        id: 'device-1',
        partNumber: '006-B4432-00',
        appVersion: '1.0.0',
        activatedAt: NOW,
        pairedAt: NOW,
        lastSeenAt: NOW,
        lastSyncAt: NOW,
        lastSyncReport: { downloaded: 3, removed: 1, failed: 0, storageFull: false, syncedIds: [] },
      },
      {
        id: 'device-2',
        partNumber: null,
        appVersion: null,
        activatedAt: null,
        pairedAt: NOW,
        lastSeenAt: null,
        lastSyncAt: null,
        lastSyncReport: null,
      },
    ]);

    const devices = await service.list('user-1');

    expect(prisma.connectIqDevice.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { pairedAt: 'desc' },
    });
    expect(devices.map((d) => [d.id, d.status, d.lastSyncAt, d.lastSync?.downloaded])).toEqual([
      ['device-1', 'active', NOW.toISOString(), 3],
      ['device-2', 'pending', null, undefined],
    ]);
  });

  it('desparear só apaga relógio do próprio usuário', async () => {
    await service.unpair('user-1', 'device-9');
    expect(prisma.connectIqDevice.deleteMany).toHaveBeenCalledWith({
      where: { id: 'device-9', userId: 'user-1' },
    });
  });

  it('grava o resumo da sincronização', async () => {
    await service.recordSyncReport(
      { id: 'device-1', userId: 'user-1', partNumber: null },
      {
        downloaded: 2,
        removed: 1,
        failures: [{ id: 'w-1', code: -1000 }],
        syncedIds: ['3f2a9c1e-0000-4000-8000-000000000001'],
        storageFull: true,
        appVersion: '1.0.1',
      },
      NOW,
    );

    expect(prisma.connectIqDevice.updateMany).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        lastSyncAt: NOW,
        lastSeenAt: NOW,
        appVersion: '1.0.1',
        lastSyncReport: {
          downloaded: 2,
          removed: 1,
          failed: 1,
          storageFull: true,
          syncedIds: ['3f2a9c1e-0000-4000-8000-000000000001'],
        },
      },
    });
  });
});

describe('DeviceTokenGuard', () => {
  const contextFor = (request: object) =>
    ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

  it('anexa o relógio autenticado à request', async () => {
    const devices = { authenticate: jest.fn().mockResolvedValue({ id: 'd', userId: 'u' }) };
    const guard = new DeviceTokenGuard(devices as unknown as ConnectIqDevicesService);
    const request: Record<string, unknown> = { headers: { authorization: `Bearer ${TOKEN}` } };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(devices.authenticate).toHaveBeenCalledWith(TOKEN);
    expect(request.ciqDevice).toEqual({ id: 'd', userId: 'u' });
  });

  it.each([undefined, 'Basic abc', 'Bearer'])(
    'responde 401 codificado para header %p',
    async (header) => {
      const devices = { authenticate: jest.fn().mockResolvedValue(null) };
      const guard = new DeviceTokenGuard(devices as unknown as ConnectIqDevicesService);

      const error = await guard
        .canActivate(contextFor({ headers: { authorization: header } }))
        .catch((e: HttpException) => e);

      expect((error as HttpException).getStatus()).toBe(401);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: ErrorCode.CIQ_DEVICE_UNAUTHORIZED,
      });
      expect(devices.authenticate).not.toHaveBeenCalled();
    },
  );
});
