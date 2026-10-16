import { HttpException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { encodeTrack } from './activity/track-codec';
import { ConnectIqActivitiesService, pausePairs } from './connect-iq-activities.service';
import type { CiqDeviceContext } from './connect-iq-devices.service';
import type { ConnectIqActivityHeaderDto } from './dto/connect-iq-activity.dto';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const START = Math.floor(new Date('2026-10-14T09:00:00.000Z').getTime() / 1000);
const DEVICE: CiqDeviceContext = { id: 'device-1', userId: 'user-1', partNumber: '006-B4432-00' };

const header = (
  overrides: Partial<ConnectIqActivityHeaderDto> = {},
): ConnectIqActivityHeaderDto => ({
  id: String(START),
  start: START,
  end: START + 2700,
  utcOffset: -10800,
  distance: 8012.4,
  timer: 2650,
  hrAvg: 151,
  hrMax: 178,
  parts: 2,
  laps: [
    { index: 0, start: 0, end: 600, distance: 1700, timer: 600, hrAvg: 132, intensity: 2 },
    { index: 1, start: 600, end: 2700, distance: 6312.4, timer: 2050, hrAvg: 158, intensity: 0 },
  ],
  pauses: [1200, 1250, 1300],
  ...overrides,
});

const expectCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getResponse()).toMatchObject({ code });
};

describe('ConnectIqActivitiesService', () => {
  let service: ConnectIqActivitiesService;
  let prisma: {
    connectIqActivity: Record<
      'findUnique' | 'findFirst' | 'findMany' | 'upsert' | 'updateMany' | 'deleteMany',
      jest.Mock
    >;
    connectIqActivityPart: Record<'findMany' | 'upsert' | 'deleteMany', jest.Mock>;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    prisma = {
      connectIqActivity: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: 'activity-1', status: 'receiving' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      connectIqActivityPart: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new ConnectIqActivitiesService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('receiveHeader', () => {
    it('cria a corrida recebendo, com as pausas em pares e sem os blocos ainda', async () => {
      await expect(service.receiveHeader(DEVICE, header(), NOW)).resolves.toEqual({
        received: [],
        complete: false,
      });

      const call = prisma.connectIqActivity.upsert.mock.calls[0][0];
      expect(call.where).toEqual({
        userId_clientId: { userId: 'user-1', clientId: String(START) },
      });
      expect(call.create).toMatchObject({
        userId: 'user-1',
        deviceId: 'device-1',
        clientId: String(START),
        startedAt: new Date(START * 1000),
        endedAt: new Date((START + 2700) * 1000),
        utcOffsetSec: -10800,
        partCount: 2,
        pauses: [[1200, 1250]],
        plannedWorkoutId: null,
      });
      expect(call.create.status).toBeUndefined();
      expect(call.create.laps[0]).toEqual({
        index: 0,
        start: 0,
        end: 600,
        distance: 1700,
        timer: 600,
        hrAvg: 132,
        hrMax: undefined,
        intensity: 2,
      });
    });

    it('guarda o treino que o app executou no relógio', async () => {
      const workoutId = '0c6b2a1e-7f4e-4b8e-9a51-3f1a2b3c4d5e';
      await service.receiveHeader(DEVICE, header({ workoutId }), NOW);

      expect(prisma.connectIqActivity.upsert.mock.calls[0][0].create.plannedWorkoutId).toBe(
        workoutId,
      );
    });

    it('apaga corridas com mais de 30 dias do usuário', async () => {
      await service.receiveHeader(DEVICE, header(), NOW);

      expect(prisma.connectIqActivity.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', createdAt: { lt: new Date('2026-09-14T12:00:00.000Z') } },
      });
    });

    it('corrida sem GPS fica pronta só com o cabeçalho', async () => {
      await expect(service.receiveHeader(DEVICE, header({ parts: 0 }), NOW)).resolves.toEqual({
        received: [],
        complete: true,
      });
      expect(prisma.connectIqActivity.upsert.mock.calls[0][0].create.status).toBe('ready');
    });

    it('reenvio devolve os blocos que já chegaram, para retomar o envio', async () => {
      prisma.connectIqActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        status: 'receiving',
        partCount: 2,
      });
      prisma.connectIqActivityPart.findMany.mockResolvedValue([{ seq: 0 }]);

      await expect(service.receiveHeader(DEVICE, header(), NOW)).resolves.toEqual({
        received: [0],
        complete: false,
      });
      expect(prisma.connectIqActivityPart.deleteMany).toHaveBeenCalledWith({
        where: { activityId: 'activity-1', seq: { gte: 2 } },
      });
    });

    it('não mexe numa corrida que o atleta já resolveu', async () => {
      prisma.connectIqActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        status: 'resolved',
        partCount: 3,
      });

      await expect(service.receiveHeader(DEVICE, header(), NOW)).resolves.toEqual({
        received: [0, 1, 2],
        complete: true,
      });
      expect(prisma.connectIqActivity.upsert).not.toHaveBeenCalled();
    });

    it.each([
      ['fim antes do início', { end: START - 1 }],
      ['mais de 48 h', { end: START + 49 * 3600 }],
      ['no futuro', { start: START + 3 * 86400, end: START + 3 * 86400 + 60 }],
      ['antiga demais', { start: START - 31 * 86400, end: START - 31 * 86400 + 60 }],
      [
        'volta fora da corrida',
        { laps: [{ index: 0, start: 0, end: 9999, distance: 1, timer: 1 }] },
      ],
    ])('recusa cabeçalho com %s', async (_label, overrides) => {
      await expectCode(
        service.receiveHeader(DEVICE, header(overrides), NOW),
        ErrorCode.CIQ_ACTIVITY_INVALID,
      );
      expect(prisma.connectIqActivity.upsert).not.toHaveBeenCalled();
    });
  });

  describe('receivePart', () => {
    const block = encodeTrack([
      { offsetSec: 0, latitude: -23.56, longitude: -46.65, heartRate: 120 },
      { offsetSec: 2, latitude: -23.5601, longitude: -46.6501, heartRate: 121 },
    ]).toString('base64');

    beforeEach(() => {
      prisma.connectIqActivity.findUnique.mockResolvedValue({
        id: 'activity-1',
        status: 'receiving',
        partCount: 2,
      });
    });

    it('guarda o bloco e marca a corrida pronta quando o último chega', async () => {
      prisma.connectIqActivityPart.findMany.mockResolvedValue([{ seq: 0 }, { seq: 1 }]);

      await expect(
        service.receivePart(DEVICE, String(START), { seq: 1, data: block }),
      ).resolves.toEqual({ received: [0, 1], complete: true });

      const stored = prisma.connectIqActivityPart.upsert.mock.calls[0][0];
      expect(stored.where).toEqual({ activityId_seq: { activityId: 'activity-1', seq: 1 } });
      expect(Buffer.from(stored.create.data)).toEqual(Buffer.from(block, 'base64'));
      expect(prisma.connectIqActivity.updateMany).toHaveBeenCalledWith({
        where: { id: 'activity-1', status: 'receiving' },
        data: { status: 'ready' },
      });
    });

    it('continua recebendo enquanto falta bloco', async () => {
      prisma.connectIqActivityPart.findMany.mockResolvedValue([{ seq: 0 }]);

      await expect(
        service.receivePart(DEVICE, String(START), { seq: 0, data: block }),
      ).resolves.toEqual({ received: [0], complete: false });
      expect(prisma.connectIqActivity.updateMany).not.toHaveBeenCalled();
    });

    it('recusa bloco que não é múltiplo de 13 bytes', async () => {
      await expectCode(
        service.receivePart(DEVICE, String(START), {
          seq: 0,
          data: Buffer.alloc(14).toString('base64'),
        }),
        ErrorCode.CIQ_ACTIVITY_INVALID,
      );
    });

    it('recusa bloco além da contagem do cabeçalho', async () => {
      await expectCode(
        service.receivePart(DEVICE, String(START), { seq: 2, data: block }),
        ErrorCode.CIQ_ACTIVITY_INVALID,
      );
    });

    it('404 quando o cabeçalho não chegou', async () => {
      prisma.connectIqActivity.findUnique.mockResolvedValue(null);

      await expectCode(
        service.receivePart(DEVICE, String(START), { seq: 0, data: block }),
        ErrorCode.CIQ_ACTIVITY_NOT_FOUND,
      );
    });
  });

  describe('listPending', () => {
    it('lista só corridas prontas dos últimos 7 dias', async () => {
      prisma.connectIqActivity.findMany.mockResolvedValue([
        {
          id: 'activity-1',
          startedAt: new Date(START * 1000),
          endedAt: new Date((START + 2700) * 1000),
          utcOffsetSec: -10800,
          distanceMeters: 8012.4,
          timerSeconds: 2650,
          avgHeartRate: 151,
          maxHeartRate: 178,
        },
      ]);

      await expect(service.listPending('user-1', NOW)).resolves.toEqual([
        {
          id: 'activity-1',
          startedAt: '2026-10-14T09:00:00.000Z',
          endedAt: '2026-10-14T09:45:00.000Z',
          utcOffsetSec: -10800,
          distanceMeters: 8012.4,
          timerSeconds: 2650,
          avgHeartRate: 151,
          maxHeartRate: 178,
        },
      ]);
      expect(prisma.connectIqActivity.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: 'ready',
          startedAt: { gte: new Date('2026-10-07T12:00:00.000Z') },
        },
        orderBy: { startedAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('detail', () => {
    it('junta os blocos em ordem e converte voltas e pausas para datas', async () => {
      prisma.connectIqActivity.findFirst.mockResolvedValue({
        id: 'activity-1',
        startedAt: new Date(START * 1000),
        endedAt: new Date((START + 2700) * 1000),
        utcOffsetSec: -10800,
        distanceMeters: 8012.4,
        timerSeconds: 2650,
        avgHeartRate: 151,
        maxHeartRate: 178,
        laps: [{ index: 0, start: 0, end: 600, distance: 1700, timer: 600, intensity: 2 }],
        pauses: [[1200, 1250]],
        parts: [
          {
            seq: 0,
            data: encodeTrack([{ offsetSec: 4, latitude: 1, longitude: 2, heartRate: null }]),
          },
          {
            seq: 1,
            data: encodeTrack([{ offsetSec: 2, latitude: 3, longitude: 4, heartRate: 140 }]),
          },
        ],
      });

      const detail = await service.detail('user-1', 'activity-1');

      expect(detail.points).toEqual([
        [2, 3, 4, 140],
        [4, 1, 2, 0],
      ]);
      expect(detail.laps).toEqual([
        {
          index: 0,
          startedAt: '2026-10-14T09:00:00.000Z',
          endedAt: '2026-10-14T09:10:00.000Z',
          distanceMeters: 1700,
          timerSeconds: 600,
          avgHeartRate: null,
          maxHeartRate: null,
          intensity: 2,
        },
      ]);
      expect(detail.pauses).toEqual([
        { startedAt: '2026-10-14T09:20:00.000Z', endedAt: '2026-10-14T09:20:50.000Z' },
      ]);
    });

    it('404 para corrida de outro usuário', async () => {
      prisma.connectIqActivity.findFirst.mockResolvedValue(null);

      await expectCode(service.detail('user-2', 'activity-1'), ErrorCode.CIQ_ACTIVITY_NOT_FOUND);
      expect(prisma.connectIqActivity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'activity-1', userId: 'user-2' } }),
      );
    });
  });

  describe('resolve', () => {
    it('guarda o treino vinculado', async () => {
      await service.resolve(
        'user-1',
        'activity-1',
        { resolution: 'linked', workoutId: 'workout-1' },
        NOW,
      );

      expect(prisma.connectIqActivity.updateMany).toHaveBeenCalledWith({
        where: { id: 'activity-1', userId: 'user-1' },
        data: { status: 'resolved', resolution: 'linked', workoutId: 'workout-1', resolvedAt: NOW },
      });
    });

    it('ignora workoutId quando não é vínculo', async () => {
      await service.resolve(
        'user-1',
        'activity-1',
        { resolution: 'dismissed', workoutId: 'x' },
        NOW,
      );

      expect(prisma.connectIqActivity.updateMany.mock.calls[0][0].data.workoutId).toBeNull();
    });

    it('404 quando a corrida não é do usuário', async () => {
      prisma.connectIqActivity.updateMany.mockResolvedValue({ count: 0 });

      await expectCode(
        service.resolve('user-1', 'activity-1', { resolution: 'free_run' }, NOW),
        ErrorCode.CIQ_ACTIVITY_NOT_FOUND,
      );
    });
  });

  it('pausePairs descarta par incompleto e invertido', () => {
    expect(pausePairs([10, 20, 40, 30, 50])).toEqual([[10, 20]]);
  });
});
