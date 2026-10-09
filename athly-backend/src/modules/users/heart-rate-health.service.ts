import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CodedBadRequestException,
  CodedNotFoundException,
} from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { HeartRateHealthDto } from './dto/heart-rate-health.dto';
import { calculateHeartRateZones, HEART_RATE_MAX_AGE_MS, validHeartRate } from './heart-rate-zones';
import { mergeHeartRateRuns, withTrainingGuidance } from './heart-rate-guidance';
import type { PlanFromHealthDto } from '../ai-planner/dto/plan-from-health.dto';

@Injectable()
export class HeartRateHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async zones(userId: string) {
    return (await this.resolve(userId)).zones;
  }

  async resolve(userId: string, incoming?: PlanFromHealthDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        restingHeartRate: true,
        maxHeartRate: true,
        dateOfBirth: true,
        appleHealthRestingHeartRate: true,
        appleHealthRestingHeartRateMeasuredAt: true,
      },
    });
    if (!user) throw new CodedNotFoundException(ErrorCode.USER_NOT_FOUND, 'User not found');
    const [context, workouts] = await Promise.all([
      this.prisma.plannerHealthContext.findUnique({ where: { userId }, select: { payload: true } }),
      this.prisma.workout.findMany({
        where: {
          userId,
          sportType: 'running',
          status: { in: ['done', 'partial'] },
          executionDetails: { not: Prisma.DbNull },
        },
        select: { executionDetails: true },
      }),
    ]);
    const saved = context?.payload as unknown as PlanFromHealthDto | undefined;
    const runs = mergeHeartRateRuns(
      Array.isArray(saved?.runs) ? saved.runs : [],
      Array.isArray(saved?.detailedSessions) ? saved.detailedSessions : [],
      workouts.map((w) => w.executionDetails),
      incoming?.runs ?? [],
      incoming?.detailedSessions ?? [],
    );
    return { zones: withTrainingGuidance(calculateHeartRateZones(user), runs), runs };
  }

  async sync(userId: string, input: HeartRateHealthDto) {
    const now = Date.now();
    const measuredAt = new Date(input.measuredAt);
    const capturedAt = new Date(input.capturedAt);
    if (
      !validHeartRate(input.restingHeartRate, 20, 150) ||
      !Number.isFinite(+measuredAt) ||
      !Number.isFinite(+capturedAt) ||
      +capturedAt > now + 5 * 60_000 ||
      +measuredAt > +capturedAt ||
      +measuredAt < now - HEART_RATE_MAX_AGE_MS
    ) {
      throw new CodedBadRequestException(
        ErrorCode.HEART_RATE_HEALTH_INVALID,
        'Dados de frequência cardíaca inválidos ou desatualizados.',
      );
    }
    // Atomic comparison: older/repeated uploads cannot replace a newer snapshot.
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { appleHealthHeartRateCapturedAt: null },
          { appleHealthHeartRateCapturedAt: { lt: capturedAt } },
        ],
      },
      data: {
        appleHealthRestingHeartRate: input.restingHeartRate,
        appleHealthRestingHeartRateMeasuredAt: measuredAt,
        appleHealthHeartRateCapturedAt: capturedAt,
      },
    });
    return this.zones(userId);
  }
}
