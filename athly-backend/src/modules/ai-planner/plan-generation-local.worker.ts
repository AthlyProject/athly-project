import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PlanGenerationStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AiPlannerService } from './ai-planner.service';
import type { PlanFromHealthDto } from './dto/plan-from-health.dto';
import { isLocalPlanGenerationEnabled } from './plan-generation-sqs.service';
import { ResumePlanningWindow, ResumeWindowExpiredError } from './weekly-calendar';

const POLL_INTERVAL_MS = 3_000;
const LEASE_MS = 15 * 60 * 1000; // mesmo lease do consumer SQS

/**
 * Substitui a fila SQS quando o backend roda na máquina do dev (`PLAN_GENERATION_INLINE=true`):
 * lê os jobs QUEUED do banco e os processa com as mesmas regras de lease e retry do
 * `PlanGenerationSqsConsumer`. Desligado em produção — ver `isLocalPlanGenerationEnabled`.
 */
@Injectable()
export class PlanGenerationLocalWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PlanGenerationLocalWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly aiPlannerService: AiPlannerService,
    private readonly prisma: PrismaService,
  ) {}

  onApplicationBootstrap() {
    if (!isLocalPlanGenerationEnabled()) return;
    this.logger.warn('PLAN_GENERATION_INLINE=true — gerando planos localmente, sem SQS');
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const next = await this.prisma.planGenerationJob.findFirst({
        where: {
          status: PlanGenerationStatus.QUEUED,
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (next) await this.process(next.id);
    } catch (err) {
      this.logger.error(`Local generation poll: ${err instanceof Error ? err.message : err}`);
    } finally {
      this.busy = false;
    }
  }

  private async process(generationId: string): Promise<void> {
    const leaseOwner = randomUUID();
    const claimed = await this.prisma.planGenerationJob.updateMany({
      where: {
        id: generationId,
        status: PlanGenerationStatus.QUEUED,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: new Date() } }],
      },
      data: {
        status: PlanGenerationStatus.PROCESSING,
        leaseOwner,
        leaseExpiresAt: new Date(Date.now() + LEASE_MS),
        error: null,
      },
    });
    if (!claimed.count) return;

    const job = await this.prisma.planGenerationJob.findFirstOrThrow({
      where: { id: generationId, leaseOwner },
    });
    try {
      const input = job.payload as unknown as PlanFromHealthDto & {
        resumeWindow?: ResumePlanningWindow;
      };
      if (input.resumeWindow) {
        await this.aiPlannerService.planFromHealth(
          job.userId,
          input,
          generationId,
          leaseOwner,
          input.resumeWindow,
        );
      } else {
        await this.aiPlannerService.planFromHealth(job.userId, input, generationId, leaseOwner);
      }
      this.logger.log(`Local plan generation ${generationId} done`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.attempts + 1;
      const failed = err instanceof ResumeWindowExpiredError || attempts >= 3;
      await this.prisma.planGenerationJob.updateMany({
        where: { id: generationId, status: PlanGenerationStatus.PROCESSING, leaseOwner },
        data: {
          status: failed ? PlanGenerationStatus.FAILED : PlanGenerationStatus.QUEUED,
          error: message,
          attempts,
          leaseOwner: null,
          leaseExpiresAt: failed ? null : new Date(Date.now() + 30 * attempts * 1000),
        },
      });
      this.logger.error(`Local plan generation ${generationId} failed: ${message}`);
    }
  }
}
