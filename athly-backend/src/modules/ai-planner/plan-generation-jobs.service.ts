import { Injectable, Logger } from '@nestjs/common';
import { PlanGenerationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PlanGenerationSqsService } from './plan-generation-sqs.service';
import { PlanFromHealthDto } from './dto/plan-from-health.dto';

@Injectable()
export class PlanGenerationJobsService {
  private readonly logger = new Logger(PlanGenerationJobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sqs: PlanGenerationSqsService,
  ) {}

  async reserve(
    tx: Prisma.TransactionClient,
    userId: string,
    weekStartDate: Date,
    input: PlanFromHealthDto,
    trainingPlanId?: string,
    retryFailed = false,
  ) {
    const job = await tx.planGenerationJob.upsert({
      where: { userId_weekStartDate: { userId, weekStartDate } },
      // A nonempty, idempotent update lets Prisma use PostgreSQL ON CONFLICT.
      update: { userId },
      create: {
        userId,
        weekStartDate,
        trainingPlanId,
        payload: input as unknown as Prisma.InputJsonValue,
      },
    });
    if (retryFailed && job.status === PlanGenerationStatus.FAILED) {
      await tx.planGenerationJob.updateMany({
        where: { id: job.id, status: PlanGenerationStatus.FAILED },
        data: {
          status: PlanGenerationStatus.QUEUED,
          payload: input as unknown as Prisma.InputJsonValue,
          result: Prisma.JsonNull,
          weeklyGoalId: null,
          workoutIds: [],
          error: null,
          attempts: 0,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: null,
          enqueuedAt: null,
          dispatchLeaseUntil: null,
        },
      });
      return tx.planGenerationJob.findUniqueOrThrow({ where: { id: job.id } });
    }
    return job;
  }

  async dispatch(generationId: string): Promise<void> {
    const lease = new Date(Date.now() + 60_000);
    const claimed = await this.prisma.planGenerationJob.updateMany({
      where: {
        id: generationId,
        status: PlanGenerationStatus.QUEUED,
        enqueuedAt: null,
        OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lt: new Date() } }],
      },
      data: { dispatchLeaseUntil: lease },
    });
    if (!claimed.count) return;
    try {
      const job = await this.prisma.planGenerationJob.findUniqueOrThrow({
        where: { id: generationId },
      });
      await this.sqs.send({ generationId, userId: job.userId });
      await this.prisma.planGenerationJob.updateMany({
        where: { id: generationId, dispatchLeaseUntil: lease },
        data: { enqueuedAt: new Date(), dispatchLeaseUntil: null },
      });
    } catch (error) {
      // Durable pending job: a publisher outage must not invalidate a saved workout.
      this.logger.error(
        `Pending SQS dispatch ${generationId}: ${error instanceof Error ? error.message : error}`,
      );
      await this.prisma.planGenerationJob.updateMany({
        where: { id: generationId, dispatchLeaseUntil: lease },
        data: { dispatchLeaseUntil: null },
      });
    }
  }

  async dispatchPending() {
    const jobs = await this.prisma.planGenerationJob.findMany({
      where: {
        status: PlanGenerationStatus.QUEUED,
        enqueuedAt: null,
        OR: [{ dispatchLeaseUntil: null }, { dispatchLeaseUntil: { lt: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true },
    });
    for (const job of jobs) await this.dispatch(job.id);
  }
}
