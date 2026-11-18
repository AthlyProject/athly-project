import { ZeppService } from './zepp.service';
import { digest, seal } from './zepp-codec';

describe('Zepp integration', () => {
  let db: any;
  let service: ZeppService;
  const env = { ...process.env };
  beforeEach(() => {
    process.env.ZEPP_ENABLED = 'true';
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
      const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ requestId, status: 'ACCEPTED' }), { status: 202 }),
      );
      await expect(service.requestBackfill('u', end - 86400, end)).resolves.toEqual({ requestId, status: 'ACCEPTED' });
      const [url, init] = fetcher.mock.calls[0];
      expect(new URL(String(url)).origin + new URL(String(url)).pathname)
        .toBe('https://api-open.zepp.com/wellness-api/rest/backfill/activities');
      expect(new URL(String(url)).searchParams.get('summaryStartTimeInSeconds')).toBe(String(end - 86400));
      expect(new URL(String(url)).searchParams.get('summaryEndTimeInSeconds')).toBe(String(end));
      expect(init).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer access' }, redirect: 'error' });
      expect(db.zeppConnection.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'u', connected: true });
      expect(db.zeppConnection.updateMany.mock.calls[1][0]).toMatchObject({
        where: { userId: 'u', connected: true }, data: { backfillRequestId: requestId },
      });
    });
    it.each([
      [-1, end], [end, end - 1], [end - 30 * 86400 - 1, end], [end - 1, end + 3600], [1.5, end], [NaN, end],
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
    it('does not call Zepp when another request holds the persistent cooldown', async () => {
      db.zeppConnection.updateMany.mockResolvedValue({ count: 0 });
      const fetcher = jest.spyOn(globalThis, 'fetch');
      await expect(service.requestBackfill('u', end, end)).rejects.toMatchObject({ status: 429 });
      expect(fetcher).not.toHaveBeenCalled();
    });
    it.each([401, 403, 429, 500, 200])('does not report HTTP %s as accepted', async (status) => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ requestId, status: 'ACCEPTED' }), { status }),
      );
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow();
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).toHaveProperty('backfillError');
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).not.toHaveProperty('backfillRequestId');
    });
    it('rejects malformed receipts and keeps failures separate from workout sync errors', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ status: 'ACCEPTED' }), { status: 202 }),
      );
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow('inválida');
      expect(db.zeppConnection.updateMany.mock.calls[1][0].data).not.toHaveProperty('error');
    });
    it('does not expose a token or provider response on network failure', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('token=secret'));
      await expect(service.requestBackfill('u', end, end)).rejects.toThrow('Não foi possível confirmar');
      expect(JSON.stringify(db.zeppConnection.updateMany.mock.calls[1][0].data)).not.toContain('secret');
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
