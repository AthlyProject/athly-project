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
