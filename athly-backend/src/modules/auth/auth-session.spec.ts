import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService session renewal', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  const user = { id: 'user-1', email: 'runner@example.com' };
  const session = { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() };
  const prisma = { session, $transaction: jest.fn() };
  const jwt = { sign: jest.fn() };
  const config = { get: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.resetAllMocks();
    session.findUnique.mockResolvedValue({
      id: 'session-1',
      user,
      expiresAt: new Date('2026-10-01'),
    });
    session.updateMany.mockResolvedValue({ count: 1 });
    session.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma));
    jwt.sign.mockReturnValue('new-access');
    config.get.mockImplementation((_key: string, fallback: string) => fallback);
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as UsersService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      {} as EmailService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('rotates atomically and extends a valid legacy session for 365 days', async () => {
    const result = await service.refreshSession('old-refresh');
    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).not.toBe('old-refresh');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', refreshToken: 'old-refresh', expiresAt: { gt: now } },
      data: { refreshToken: result.refreshToken, expiresAt: new Date('2027-09-28T12:00:00Z') },
    });
    expect(session.create).not.toHaveBeenCalled();
  });

  it('creates new sessions with the same renewable lifetime', async () => {
    await (service as any).createSession(user);
    expect(session.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        refreshToken: expect.any(String),
        expiresAt: new Date('2027-09-28T12:00:00Z'),
      },
    });
  });

  it('uses 365 days when the lifetime setting is malformed', async () => {
    config.get.mockReturnValue('invalid');
    await service.refreshSession('old-refresh');
    expect(session.updateMany.mock.calls[0][0].data.expiresAt).toEqual(
      new Date('2027-09-28T12:00:00Z'),
    );
  });

  it.each([null, { id: 'session-1', user, expiresAt: now }])(
    'rejects revoked or expired sessions',
    async (value) => {
      session.findUnique.mockResolvedValue(value);
      await expect(service.refreshSession('old-refresh')).rejects.toMatchObject({ status: 401 });
      expect(session.updateMany).not.toHaveBeenCalled();
    },
  );

  it('rejects a token already consumed or revoked during rotation', async () => {
    session.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refreshSession('old-refresh')).rejects.toMatchObject({ status: 401 });
  });

  it('propagates database errors without deleting the old session', async () => {
    session.updateMany.mockRejectedValue(new Error('database unavailable'));
    await expect(service.refreshSession('old-refresh')).rejects.toThrow('database unavailable');
    expect(session.create).not.toHaveBeenCalled();
  });
});
