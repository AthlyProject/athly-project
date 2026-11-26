import { ZeppService } from './zepp.service';
import { digest, seal } from './zepp-codec';

describe('Zepp integration', () => {
  let db: any;
  let service: ZeppService;
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ZEPP_ENABLED = 'true';
    process.env.ZEPP_WORKOUTS_VALIDATED = 'false';
    process.env.ZEPP_WORKOUTS_MANUAL_ENABLED = 'false';
    process.env.ZEPP_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.ZEPP_CLIENT_ID = 'client';
    process.env.ZEPP_CLIENT_SECRET = 'secret';
    process.env.ZEPP_REDIRECT_URI = 'https://example.test/zepp/callback';
    db = {
      zeppConnection: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      zeppActivity: {
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      workout: { findFirst: jest.fn() },
      zeppActivityLink: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    db.$transaction = jest.fn(async (operations) => Promise.all(operations));
    service = new ZeppService(db);
  });
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });
  it('is disabled by default and cannot start OAuth', async () => {
    delete process.env.ZEPP_ENABLED;
    await expect(service.authorize('u', 'UTC')).rejects.toThrow('indisponível');
    expect(db.zeppConnection.upsert).not.toHaveBeenCalled();
  });
  it('stores a hashed expiring state bound to the authenticated account', async () => {
    const result = await service.authorize('u', 'America/Sao_Paulo');
    const q = new URLSearchParams(result.url.split('?')[1]);
    expect(q.get('token')).toBe('["access","refresh"]');
    expect(db.zeppConnection.upsert.mock.calls[0][0].create).toMatchObject({
      userId: 'u',
      stateHash: digest(q.get('state')!),
    });
    await expect(service.authorize('u', 'invalid')).rejects.toThrow('Fuso');
  });
  it('rejects expired state without calling Zepp', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    db.zeppConnection.findFirst.mockResolvedValue(null);
    await expect(service.callback('old', 'code')).rejects.toThrow('expirada');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('queries candidates by activity date and preserves resolved activities for manual selection', async () => {
    db.workout.findFirst.mockResolvedValue({ id: 'w' });
    db.zeppActivityLink.findMany.mockResolvedValue([{ summaryId: 'other-run' }]);
    db.zeppActivity.findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'a', summary: { distanceMeters: 1000 }, hasRoute: true }]);
    const result = await service.candidates('u', 'w', 1000, 2000);
    expect(result.items).toHaveLength(1);
    expect(db.zeppActivity.findMany.mock.calls[0][0].where).toMatchObject({
      userId: 'u',
      status: { in: ['ready', 'resolved'] },
      startedAt: { gte: new Date(1000000), lt: new Date(2000000) },
      summaryId: { notIn: ['other-run'] },
    });
    expect(db.zeppActivity.findMany.mock.calls[0][0].where).not.toHaveProperty('createdAt');
  });
  it('paginates without dropping the first activity on the next page', async () => {
    db.workout.findFirst.mockResolvedValue({ id: 'w' });
    db.zeppActivityLink.findMany.mockResolvedValue([]);
    db.zeppActivity.findMany = jest
      .fn()
      .mockResolvedValue(Array.from({ length: 51 }, (_, i) => ({ id: `a${i}`, summary: {} })));
    const page = await service.candidates('u', 'w', 1000, 2000);
    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toBe('a49');
    db.zeppActivity.findMany.mockResolvedValue([{ id: 'a50', summary: {} }]);
    expect((await service.candidates('u', 'w', 1000, 2000, page.nextCursor!)).items[0].id).toBe(
      'a50',
    );
    expect(db.zeppActivity.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: 'a49' }, skip: 1 }),
    );
    expect(db.zeppActivityLink.findMany).toHaveBeenCalledWith({
      where: { userId: 'u', workoutId: { not: 'w' } },
    });
  });
  it('does not list candidates for another account workout', async () => {
    db.workout.findFirst.mockResolvedValue(null);
    await expect(service.candidates('u', 'foreign', 1000, 2000)).rejects.toThrow();
    expect(db.zeppActivityLink.findMany).not.toHaveBeenCalled();
  });
  describe('activity history', () => {
    const requestId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const end = Math.floor(Date.now() / 1000);
    beforeEach(() => {
      const connection = {
        connected: true,
        tokens: seal(JSON.stringify({ access_token: 'access' }), process.env.ZEPP_TOKEN_KEY!),
        expiresAt: new Date(Date.now() + 3600_000),
      };
      db.zeppConnection.findUnique.mockResolvedValue(connection);
      db.zeppConnection.findUniqueOrThrow.mockResolvedValue(connection);
      db.zeppConnection.updateMany.mockResolvedValue({ count: 1 });
    });
    it('requests FIT history with the user token, stores the receipt and works with workouts disabled', async () => {
      process.env.ZEPP_WORKOUTS_VALIDATED = 'false';
      const fetcher = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ requestId, status: 'ACCEPTED' }), { status: 202 }),
        );
      await expect(service.requestBackfill('u', end - 86400, end)).resolves.toEqual({
        requestId,
        status: 'ACCEPTED',
      });
      const [url, init] = fetcher.mock.calls[0];
      expect(new URL(String(url)).origin + new URL(String(url)).pathname).toBe(
        'https://api-open.zepp.com/wellness-api/rest/backfill/activities',
      );
      expect(new URL(String(url)).searchParams.get('summaryStartTimeInSeconds')).toBe(
        String(end - 86400),
      );
      expect(new URL(String(url)).searchParams.get('summaryEndTimeInSeconds')).toBe(String(end));
      expect(init).toMatchObject({
        method: 'GET',
        headers: { Authorization: 'Bearer access' },
        redirect: 'error',
      });
      expect(db.zeppConnection.updateMany.mock.calls[0][0].where).toMatchObject({
        userId: 'u',
        connected: true,
      });
      expect(db.zeppConnection.updateMany.mock.calls[1][0]).toMatchObject({
        where: { userId: 'u', connected: true },
        data: { backfillRequestId: requestId },
      });
    });
    it.each([
      [-1, end],
      [end, end - 1],
      [end - 30 * 86400 - 1, end],
      [end - 1, end + 3600],
      [1.5, end],
      [NaN, end],
    ])('rejects invalid time ranges (%s, %s) before accessing credentials', async (start, stop) => {
      const fetcher = jest.spyOn(globalThis, 'fetch');
      await expect(service.requestBackfill('u', start, stop)).rejects.toThrow('período');
      expect(db.zeppConnection.findUnique).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    });
    it('requires an enabled integration and connected account', async () => {
      process.env.ZEPP_ENABLED = 'false';
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow('indisponível');
      process.env.ZEPP_ENABLED = 'true';
      db.zeppConnection.findUnique.mockResolvedValue(null);
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow('Conecte');
      expect(db.zeppConnection.updateMany).not.toHaveBeenCalled();
    });
    it('reuses an accepted request for the same window for five minutes', async () => {
      const connection = await db.zeppConnection.findUnique();
      db.zeppConnection.findUnique.mockResolvedValue({
        ...connection,
        backfillRequestId: requestId,
        backfillRequestedAt: new Date(),
        backfillWindowStart: end - 86400,
        backfillWindowEnd: end - 20,
      });
      const fetcher = jest.spyOn(globalThis, 'fetch');
      await expect(service.requestBackfill('u', end - 86400, end)).resolves.toEqual({
        requestId,
        status: 'ACCEPTED',
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(db.zeppConnection.updateMany).not.toHaveBeenCalled();
    });
    it('does not call Zepp when another request holds the persistent cooldown', async () => {
      db.zeppConnection.updateMany.mockResolvedValue({ count: 0 });
      const fetcher = jest.spyOn(globalThis, 'fetch');
      await expect(service.requestBackfill('u', end, end)).rejects.toMatchObject({ status: 429 });
      expect(fetcher).not.toHaveBeenCalled();
    });
    it.each([401, 403, 429, 500, 200])('does not report HTTP %s as accepted', async (status) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ requestId, status: 'ACCEPTED' }), { status }),
        );
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow();
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).toHaveProperty('backfillError');
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).not.toHaveProperty(
        'backfillRequestId',
      );
    });
    it('rejects malformed receipts and keeps failures separate from workout sync errors', async () => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ status: 'ACCEPTED' }), { status: 202 }));
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow('inválida');
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).not.toHaveProperty('error');
    });
    it('does not expose a token or provider response on network failure', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('token=secret'));
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow(
        'Não foi possível confirmar',
      );
      expect(JSON.stringify(db.zeppConnection.updateMany.mock.calls[1][0].data)).not.toContain(
        'secret',
      );
    });
  });
  it('consumes state once and encrypts the OAuth token', async () => {
    db.zeppConnection.findFirst.mockResolvedValue({ userId: 'u' });
    db.zeppConnection.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          user_id: 'z',
          access_token: 'access',
          refresh_token: 'refresh',
          expires_in: 3600,
        }),
      ),
    );
    await service.callback('state', 'code');
    const data = db.zeppConnection.update.mock.calls[0][0].data;
    expect(data.connected).toBe(true);
    expect(data.tokens).not.toContain('access');
    db.zeppConnection.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.callback('state', 'code')).rejects.toThrow();
  });
  it('persists duplicate events idempotently without downloading synchronously', async () => {
    db.zeppConnection.findFirst.mockResolvedValue({ userId: 'u' });
    const fetcher = jest.spyOn(globalThis, 'fetch');
    const body = JSON.stringify([
      JSON.stringify({
        activityFiles: [
          {
            fileType: 'FIT',
            userId: 'z',
            summaryId: '1-file',
            callbackURL: 'https://api-open.zepp.com/api/activity/file?id=1&token=x',
          },
        ],
      }),
    ]);
    await service.webhook(body);
    await service.webhook(body);
    expect(db.zeppActivity.upsert).toHaveBeenCalledTimes(2);
    expect(db.zeppActivity.upsert.mock.calls[0][0]).toMatchObject({
      where: { userId_summaryId: { userId: 'u', summaryId: '1-file' } },
      update: {},
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('revokes remotely and releases the Zepp account on disconnect', async () => {
    const key = process.env.ZEPP_TOKEN_KEY!;
    db.zeppConnection.findUniqueOrThrow.mockResolvedValue({
      connected: true,
      tokens: seal(JSON.stringify({ access_token: 'access' }), key),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    await service.disconnect('u');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://api-open.zepp.com/users/-/thirdparty/unauthorize',
    );
    expect(db.zeppConnection.updateMany.mock.calls[0][0].data).toMatchObject({
      connected: false,
      zeppUserId: null,
      tokens: null,
      stateHash: null,
    });
    expect(db.zeppActivity.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u' } });
  });
  it('refreshes using the refresh token in both form and header', async () => {
    const key = process.env.ZEPP_TOKEN_KEY!;
    db.zeppConnection.findUniqueOrThrow.mockResolvedValue({
      connected: true,
      tokens: seal(JSON.stringify({ access_token: 'old', refresh_token: 'refresh' }), key),
      expiresAt: new Date(0),
    });
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'new', refresh_token: 'refresh', expires_in: 3600 }),
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    await service.disconnect('u');
    const request = fetcher.mock.calls[0][1]!;
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer refresh');
    expect((request.body as URLSearchParams).get('refresh_token')).toBe('refresh');
    expect((fetcher.mock.calls[1][1]!.headers as Record<string, string>).Authorization).toBe(
      'Bearer new',
    );
  });
  it('does not serve another account’s FIT', async () => {
    db.zeppActivity.findFirst.mockResolvedValue(null);
    await expect(service.file('other', 'id')).rejects.toThrow();
    expect(db.zeppActivity.findFirst.mock.calls[0][0].where).toMatchObject({
      userId: 'other',
      id: 'id',
    });
  });
  it('checks ownership before linking', async () => {
    db.workout.findFirst.mockResolvedValue(null);
    await expect(service.resolve('u', 'id', 'linked', 'foreign')).rejects.toThrow('Treino');
    expect(db.zeppActivity.updateMany).not.toHaveBeenCalled();
  });
});

describe('Zepp manual workout delivery', () => {
  const env = { ...process.env };
  let db: any;
  let service: ZeppService;
  let fetcher: jest.SpyInstance;
  const workout = {
    id: 'w',
    title: 'Ritmo 30 minutos',
    sportType: 'running',
    dateScheduled: new Date('2026-11-26T00:00:00Z'),
    segments: {
      schemaVersion: 1,
      sport: 'running',
      segments: [
        {
          id: 'work',
          kind: 'work',
          end: { by: 'durationSec', value: 1800 },
          target: { paceSecPerKmMin: 300, paceSecPerKmMax: 340 },
        },
      ],
    },
  };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T01:00:00Z'));
    process.env.ZEPP_ENABLED = 'true';
    process.env.ZEPP_WORKOUTS_VALIDATED = 'false';
    process.env.ZEPP_WORKOUTS_MANUAL_ENABLED = 'true';
    process.env.ZEPP_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');
    const connection = {
      userId: 'u',
      connected: true,
      timeZone: 'America/Sao_Paulo',
      tokens: seal(JSON.stringify({ access_token: 'access' }), process.env.ZEPP_TOKEN_KEY),
      expiresAt: new Date(Date.now() + 3600_000),
    };
    db = {
      zeppConnection: {
        findUnique: jest.fn().mockResolvedValue(connection),
        findUniqueOrThrow: jest.fn().mockResolvedValue(connection),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([connection]),
      },
      workout: { findMany: jest.fn().mockResolvedValue([workout]) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      zeppWorkoutMapping: { upsert: jest.fn().mockResolvedValue({ id: 42 }) },
      zeppActivity: { deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () => new Response(JSON.stringify({ code: 1, message: 'success', data: [] })),
      );
    service = new ZeppService(db);
  });
  afterEach(() => {
    process.env = { ...env };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  it('sends the complete local seven-day window and returns the provider receipt', async () => {
    await expect(service.requestSync('u')).resolves.toEqual({
      status: 'ACCEPTED',
      workoutCount: 1,
      startDate: '2026-11-26',
      endDate: '2026-12-02',
    });
    expect(db.workout.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u',
      status: 'scheduled',
      sportType: 'running',
      trainingPlan: { status: 'ACTIVE' },
      dateScheduled: { gte: new Date('2026-11-26'), lte: new Date('2026-12-02') },
    });
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('https://api-open.zepp.com/users/-/workouts?version=2.0.0');
    expect(request.headers.Authorization).toBe('Bearer access');
    expect(JSON.parse(request.body)).toMatchObject({
      startDate: '2026-11-26',
      endDate: '2026-12-02',
      workouts: [
        {
          workoutId: 42,
          workoutDate: '2026-11-26',
          sport: 'RUNNING',
          steps: [{ durationType: 'TIME', durationValue: 1800, targetType: 'PACE_LAP' }],
        },
      ],
    });
    expect(db.zeppConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { syncHash: expect.any(String), lastSyncAt: expect.any(Date), error: null },
      }),
    );
    expect(db.zeppConnection.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { leaseUntil: null, nextSyncAt: expect.any(Date) },
      }),
    );
  });
  it('does not start automatic delivery while only manual testing is enabled', async () => {
    await service.drain();
    expect(db.zeppConnection.findMany).not.toHaveBeenCalled();
    expect(db.zeppActivity.findMany).toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect((await service.status('u')).workoutsEnabled).toBe(true);
  });
  it('sends the bpm snapshot displayed in Plan even when profile zones are unavailable or changed', async () => {
    db.workout.findMany.mockResolvedValue([
      {
        ...workout,
        segments: {
          ...workout.segments,
          segments: [
            {
              ...workout.segments.segments[0],
              target: { hrZone: 2, hrMinBpm: 138, hrMaxBpm: 150, rpe: 3 },
            },
          ],
        },
      },
    ]);
    for (const profile of [null, { restingHeartRate: 65, maxHeartRate: 195 }]) {
      db.user.findUnique.mockResolvedValue(profile);
      await expect(service.requestSync('u')).resolves.toMatchObject({ status: 'ACCEPTED' });
      const body = JSON.parse(fetcher.mock.calls.at(-1)![1].body);
      expect(body.workouts[0].steps[0]).toMatchObject({
        targetType: 'HEART_RATE_LAP',
        targetValueLow: 138,
        targetValueHigh: 150,
      });
    }
  });
  it('uses current profile HR zones only for legacy prescriptions without a bpm snapshot', async () => {
    db.user.findUnique.mockResolvedValue({ restingHeartRate: 60, maxHeartRate: 190 });
    db.workout.findMany.mockResolvedValue([
      {
        ...workout,
        segments: {
          ...workout.segments,
          segments: [{ ...workout.segments.segments[0], target: { hrZone: 2 } }],
        },
      },
    ]);
    await service.requestSync('u');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).workouts[0].steps[0]).toMatchObject({
      targetType: 'HEART_RATE_LAP',
      targetValueLow: 138,
      targetValueHigh: 150,
    });
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.requestSync('u')).rejects.toThrow('zona de FC');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('requires the delivery flag, integration flag and a connected account', async () => {
    process.env.ZEPP_WORKOUTS_MANUAL_ENABLED = 'false';
    await expect(service.requestSync('u')).rejects.toThrow('indisponível');
    expect((await service.status('u')).workoutsEnabled).toBe(false);
    process.env.ZEPP_WORKOUTS_VALIDATED = 'true';
    expect((await service.status('u')).workoutsEnabled).toBe(true);
    process.env.ZEPP_ENABLED = 'false';
    await expect(service.requestSync('u')).rejects.toThrow('indisponível');
    expect((await service.status('u')).workoutsEnabled).toBe(false);
    process.env.ZEPP_ENABLED = 'true';
    db.zeppConnection.findUnique.mockResolvedValue(null);
    await expect(service.requestSync('u')).rejects.toThrow('Conecte');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not overlap another delivery or release its lease', async () => {
    db.zeppConnection.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.requestSync('u')).rejects.toMatchObject({ status: 409 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.zeppConnection.updateMany).toHaveBeenCalledTimes(1);
  });
  it('identifies incompatible prescriptions and never sends a partial week', async () => {
    const invalid = {
      ...workout,
      id: 'other',
      title: 'Corrida leve',
      segments: {
        ...workout.segments,
        segments: [{ ...workout.segments.segments[0], target: { rpe: 3 } }],
      },
    };
    db.workout.findMany.mockResolvedValue([workout, invalid]);
    await expect(service.requestSync('u')).rejects.toThrow('Corrida leve (2026-11-26)');
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.zeppConnection.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { leaseUntil: null, nextSyncAt: expect.any(Date) },
      }),
    );
  });
  it.each([401, 403, 500, 200])(
    'does not confirm a rejected delivery (HTTP %s)',
    async (status) => {
      fetcher.mockResolvedValue(new Response(JSON.stringify({ code: -1 }), { status }));
      await expect(service.requestSync('u')).rejects.toThrow('Zepp');
      expect(db.zeppConnection.updateMany.mock.calls.some(([arg]) => arg.data.lastSyncAt)).toBe(
        false,
      );
    },
  );
  it('does not leak provider or network credentials in errors', async () => {
    fetcher.mockRejectedValue(new Error('Authorization: Bearer secret'));
    await expect(service.requestSync('u')).rejects.toThrow('Não foi possível confirmar');
    expect(JSON.stringify(db.zeppConnection.updateMany.mock.calls)).not.toContain('secret');
  });
  it('sends an empty window to clear obsolete prescriptions', async () => {
    db.workout.findMany.mockResolvedValue([]);
    await expect(service.requestSync('u')).resolves.toMatchObject({
      workoutCount: 0,
      status: 'ACCEPTED',
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body).workouts).toEqual([]);
  });
});

describe('Zepp durable FIT worker', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.restoreAllMocks();
  });
  it('recovers an expired lease and schedules a failed download for retry', async () => {
    process.env.ZEPP_ENABLED = 'true';
    process.env.ZEPP_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');
    const key = process.env.ZEPP_TOKEN_KEY;
    const a = {
      id: 'a',
      userId: 'u',
      summaryId: '1',
      attempts: 0,
      createdAt: new Date(),
      downloadUrl: seal('https://api-open.zepp.com/api/activity/file?id=1&token=x', key),
    };
    const db: any = {
      zeppConnection: {
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          connected: true,
          tokens: seal(JSON.stringify({ access_token: 'access' }), key),
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      },
      zeppActivity: {
        deleteMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([a]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }));
    await new ZeppService(db).drain();
    expect(db.zeppActivity.updateMany.mock.calls[0][0].where.OR).toEqual([
      { leaseUntil: null },
      { leaseUntil: { lt: expect.any(Date) } },
    ]);
    expect(db.zeppActivity.updateMany.mock.calls[1][0].data).toMatchObject({
      status: 'pending',
      leaseUntil: null,
      nextAttemptAt: expect.any(Date),
    });
  });
});
