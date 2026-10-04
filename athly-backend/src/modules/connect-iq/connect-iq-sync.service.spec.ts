import { HttpException } from '@nestjs/common';
import { Decoder, Stream } from '@garmin/fitsdk';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { ConnectIqSyncService } from './connect-iq-sync.service';

// 12:00 UTC = 09:00 em São Paulo.
const NOW = new Date('2026-10-07T12:00:00.000Z');

const segments = (paceMin = 280) => ({
  schemaVersion: 1,
  sport: 'running',
  segments: [
    { id: 'wu', kind: 'warmup', end: { by: 'durationSec', value: 600 } },
    {
      id: 'set',
      kind: 'set',
      repetitions: 6,
      children: [
        {
          id: 'work',
          kind: 'work',
          end: { by: 'distanceM', value: 400 },
          target: { paceSecPerKmMin: paceMin, paceSecPerKmMax: paceMin + 15 },
        },
        { id: 'rec', kind: 'recovery', end: { by: 'durationSec', value: 90 } },
      ],
    },
    { id: 'cd', kind: 'cooldown', end: { by: 'durationSec', value: 300 } },
  ],
});

let sequence = 0;
const workout = (date: string, overrides: Record<string, unknown> = {}) => ({
  id: `3f2a9c1e-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  title: 'Intervalado 6x400m',
  dateScheduled: new Date(`${date}T00:00:00.000Z`),
  sportType: 'running',
  segments: segments(),
  ...overrides,
});

describe('ConnectIqSyncService', () => {
  let service: ConnectIqSyncService;
  let prisma: {
    workout: { findMany: jest.Mock };
    plannerHealthContext: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      workout: { findMany: jest.fn().mockResolvedValue([]) },
      plannerHealthContext: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new ConnectIqSyncService(prisma as unknown as PrismaService);
  });

  describe('manifest', () => {
    it('busca treinos de corrida agendados nos próximos 7 dias do plano ativo', async () => {
      await service.manifest('user-1', '2026-10-07', NOW);

      expect(prisma.workout.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: 'scheduled',
          sportType: 'running',
          dateScheduled: {
            gte: new Date('2026-10-07T00:00:00.000Z'),
            lte: new Date('2026-10-13T00:00:00.000Z'),
          },
          trainingPlan: { status: 'ACTIVE' },
        },
        orderBy: [{ dateScheduled: 'asc' }, { createdAt: 'asc' }],
        take: 14,
        select: { id: true, title: true, dateScheduled: true, sportType: true, segments: true },
      });
      expect(prisma.plannerHealthContext.findUnique).not.toHaveBeenCalled();
    });

    it('lista id, rev, data, nome e número de passos, sem treinos que o relógio não roda', async () => {
      const run = workout('2026-10-07');
      prisma.workout.findMany.mockResolvedValue([
        run,
        workout('2026-10-08', { segments: null }),
        workout('2026-10-09', { title: 'Rodagem', segments: { segments: [] } }),
      ]);

      const manifest = await service.manifest('user-1', '2026-10-07', NOW);

      expect(manifest).toEqual({
        v: 1,
        today: '2026-10-07',
        workouts: [
          {
            id: run.id,
            rev: expect.stringMatching(/^[0-9a-f]{12}$/),
            date: '2026-10-07',
            name: '07/10 Intervalado 6x400m',
            steps: 5,
          },
        ],
      });
    });

    it('diferencia nomes repetidos no mesmo dia e corta em 7 treinos', async () => {
      prisma.workout.findMany.mockResolvedValue([
        workout('2026-10-07'),
        workout('2026-10-07'),
        ...['08', '09', '10', '11', '12', '13'].map((day) => workout(`2026-10-${day}`)),
      ]);

      const { workouts } = await service.manifest('user-1', '2026-10-07', NOW);

      expect(workouts).toHaveLength(7);
      expect(workouts.slice(0, 2).map((w) => w.name)).toEqual([
        '07/10 Intervalado 6x400m',
        '07/10 Intervalado 6x40 2',
      ]);
      expect(workouts[0].rev).not.toBe(workouts[1].rev);
    });

    it('ignora data do relógio fora de ±1 dia e usa o fuso salvo pelo app', async () => {
      prisma.plannerHealthContext.findUnique.mockResolvedValue({ timeZone: 'Asia/Tokyo' });

      // 12:00 UTC = 21:00 em Tóquio, ainda dia 7.
      const manifest = await service.manifest('user-1', '2026-01-01', NOW);

      expect(manifest.today).toBe('2026-10-07');
      expect(prisma.plannerHealthContext.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { timeZone: true },
      });
    });

    it('sem data do relógio e sem fuso salvo, usa São Paulo', async () => {
      const lateNight = new Date('2026-10-08T02:00:00.000Z'); // 23:00 do dia 7 em SP

      await expect(service.manifest('user-1', undefined, lateNight)).resolves.toMatchObject({
        today: '2026-10-07',
      });
    });
  });

  describe('workoutFit', () => {
    it('gera o FIT do treino com o mesmo nome do manifesto', async () => {
      const run = workout('2026-10-07');
      prisma.workout.findMany.mockResolvedValue([run]);

      const bytes = await service.workoutFit('user-1', run.id, '2026-10-07', NOW);

      const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read({
        convertTypesToStrings: true,
      });
      expect(errors).toEqual([]);
      expect(messages.workoutMesgs?.[0]).toMatchObject({
        wktName: '07/10 Intervalado 6x400m',
        sport: 'running',
        numValidSteps: 5,
      });
    });

    it('responde 404 codificado para treino fora do manifesto (outro usuário, passado, feito)', async () => {
      prisma.workout.findMany.mockResolvedValue([workout('2026-10-07')]);

      const error = await service
        .workoutFit('user-1', '3f2a9c1e-0000-4000-8000-999999999999', '2026-10-07', NOW)
        .catch((e: HttpException) => e);

      expect((error as HttpException).getStatus()).toBe(404);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: ErrorCode.CIQ_WORKOUT_NOT_AVAILABLE,
      });
    });
  });
});
