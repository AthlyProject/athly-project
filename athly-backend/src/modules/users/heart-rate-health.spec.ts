import { INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import request from 'supertest';
import { PrismaService } from '../../database/prisma.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HeartRateHealthService } from './heart-rate-health.service';

const secret = 'heart-rate-test-only';
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: secret });
  }
  validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}

describe('Heart rate profile API', () => {
  let app: INestApplication;
  let users: Record<string, any>;
  const prisma = {
    plannerHealthContext: { findUnique: jest.fn().mockResolvedValue(null) },
    workout: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
  };
  const token = new JwtService({ secret }).sign({ sub: 'user-1' });
  const capturedAt = () => new Date().toISOString();
  const sample = () => ({
    restingHeartRate: 60,
    measuredAt: new Date(Date.now() - 60_000).toISOString(),
    capturedAt: capturedAt(),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [UsersController],
      providers: [
        UsersService,
        HeartRateHealthService,
        TestJwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    users = {
      'user-1': {
        id: 'user-1',
        name: 'Runner',
        email: 'test@example.com',
        maxHeartRate: 190,
        restingHeartRate: null,
        dateOfBirth: new Date('1990-01-01'),
      },
      'user-2': { id: 'user-2', maxHeartRate: 180, restingHeartRate: 70 },
    };
    prisma.user.findUnique.mockImplementation(async ({ where }) => users[where.id] ?? null);
    prisma.user.update.mockImplementation(async ({ where, data }) =>
      Object.assign(users[where.id], data),
    );
    prisma.user.updateMany.mockImplementation(async ({ where, data }) => {
      const user = users[where.id];
      if (
        !user ||
        (user.appleHealthHeartRateCapturedAt &&
          user.appleHealthHeartRateCapturedAt >= where.OR[1].appleHealthHeartRateCapturedAt.lt)
      )
        return { count: 0 };
      Object.assign(user, data);
      return { count: 1 };
    });
  });
  const get = () =>
    request(app.getHttpServer()).get('/users/me/heart-rate-zones').auth(token, { type: 'bearer' });
  const put = (body: unknown) =>
    request(app.getHttpServer())
      .put('/users/me/heart-rate-health')
      .auth(token, { type: 'bearer' })
      .send(body);
  const profile = (body: unknown) =>
    request(app.getHttpServer()).put('/users/profile').auth(token, { type: 'bearer' }).send(body);

  it('requires authentication on both endpoints', async () => {
    await request(app.getHttpServer()).get('/users/me/heart-rate-zones').expect(401);
    await request(app.getHttpServer())
      .put('/users/me/heart-rate-health')
      .send(sample())
      .expect(401);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('stores only the authenticated user snapshot and returns its computed zones', async () => {
    const result = await put(sample()).expect(200);
    expect(result.body).toMatchObject({
      status: 'available',
      restingHeartRate: { source: 'apple_health', bpm: 60 },
      isEstimated: false,
    });
    expect(users['user-1'].restingHeartRate).toBeNull();
    expect(users['user-2'].appleHealthRestingHeartRate).toBeUndefined();
    expect(prisma.user.updateMany.mock.calls[0][0].where.id).toBe('user-1');
    await put({ ...sample(), userId: 'user-2' }).expect(400);
  });
  it('ignores repeated and out-of-order uploads', async () => {
    const current = sample();
    await put(current).expect(200);
    await put({ ...current, restingHeartRate: 80 }).expect(200);
    await put({
      ...current,
      restingHeartRate: 90,
      capturedAt: new Date(Date.now() - 30_000).toISOString(),
    }).expect(200);
    expect(users['user-1'].appleHealthRestingHeartRate).toBe(60);
    expect((await get().expect(200)).body.restingHeartRate.bpm).toBe(60);
  });
  it.each([null, 0, 151, 60.1, '60'])(
    'rejects invalid resting bpm %s',
    async (restingHeartRate) => {
      await put({ ...sample(), restingHeartRate }).expect(400);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    },
  );
  it('rejects stale samples, future captures and samples after capture', async () => {
    await put({ ...sample(), measuredAt: '2020-01-01T00:00:00Z' }).expect(400);
    await put({ ...sample(), capturedAt: new Date(Date.now() + 600_000).toISOString() }).expect(
      400,
    );
    await put({ ...sample(), measuredAt: new Date(Date.now() + 1000).toISOString() }).expect(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('preserves overrides on unrelated profile edits and clears only explicit nulls', async () => {
    users['user-1'].restingHeartRate = 65;
    await put(sample()).expect(200);
    await profile({ name: 'Updated' }).expect(200);
    expect(users['user-1'].restingHeartRate).toBe(65);
    await profile({ restingHeartRate: null, maxHeartRate: null }).expect(200);
    const result = await get().expect(200);
    expect(result.body).toMatchObject({
      isEstimated: true,
      restingHeartRate: { source: 'apple_health' },
      maxHeartRate: { source: 'age_estimate' },
    });
    expect(users['user-1'].maxHeartRate).toBeNull();
  });
  it('validates partial profile updates against the other saved value', async () => {
    users['user-1'].restingHeartRate = 140;
    const result = await profile({ maxHeartRate: 130 }).expect(400);
    expect(result.body.code).toBe('HEART_RATE_RANGE_INVALID');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('returns missing data without fabricating a resting value', async () => {
    expect((await get().expect(200)).body).toMatchObject({
      status: 'insufficient_data',
      missingData: ['resting_heart_rate'],
      zones: [],
    });
  });
});
