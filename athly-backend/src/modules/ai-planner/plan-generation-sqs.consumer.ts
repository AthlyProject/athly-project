import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
import { ResumePlanningWindow, ResumeWindowExpiredError } from './weekly-calendar';
import { randomUUID } from 'node:crypto';
import { PlanGenerationStatus } from '@prisma/client';
import { AiPlannerService } from './ai-planner.service';
import { PrismaService } from '../../database/prisma.service';
import type { PlanFromHealthDto } from './dto/plan-from-health.dto';
import type { PlanGenerationMessageBody } from './plan-generation-sqs.service';

const VISIBILITY_TIMEOUT_SECONDS = 15 * 60; // 15 min — mesmo que o lease antigo
const MAX_MESSAGES = 1;
const LONG_POLL_SECONDS = 20;

@Injectable()
export class PlanGenerationSqsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PlanGenerationSqsConsumer.name);
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private running = false;

  constructor(
    private readonly aiPlannerService: AiPlannerService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    this.queueUrl = process.env.AWS_SQS_PLAN_GENERATION_QUEUE_URL ?? '';
  }

  onApplicationBootstrap() {
    if (!this.queueUrl) {
      this.logger.warn('AWS_SQS_PLAN_GENERATION_QUEUE_URL not set — SQS consumer will not start');
      return;
    }
    this.running = true;
    void this.poll();
  }

  onApplicationShutdown() {
    this.running = false;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: MAX_MESSAGES,
            WaitTimeSeconds: LONG_POLL_SECONDS,
            VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
          }),
        );

        const messages = response.Messages ?? [];
        await Promise.all(messages.map((msg) => this.processMessage(msg)));
      } catch (err) {
        if (this.running) {
          this.logger.error(`SQS poll error: ${err instanceof Error ? err.message : String(err)}`);
          // Breve pausa antes de tentar de novo após falha de rede
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
    }
  }

  private async processMessage(msg: { Body?: string; ReceiptHandle?: string }): Promise<void> {
    let body: PlanGenerationMessageBody;
    try {
      body = JSON.parse(msg.Body ?? '{}') as PlanGenerationMessageBody;
    } catch {
      this.logger.error('Malformed SQS message body — deleting');
      await this.deleteMessage(msg.ReceiptHandle!);
      return;
    }

    const { generationId, userId } = body;
    if (!generationId || !userId || !msg.ReceiptHandle) {
      if (msg.ReceiptHandle) await this.deleteMessage(msg.ReceiptHandle);
      return;
    }
    let job = await this.prisma.planGenerationJob.findFirst({
      where: { id: generationId, userId },
    });
    if (!job || job.status === 'COMPLETED' || job.status === 'FAILED') {
      await this.deleteMessage(msg.ReceiptHandle);
      return;
    }
    const leaseOwner = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + VISIBILITY_TIMEOUT_SECONDS * 1000);
    const claimed = await this.prisma.planGenerationJob.updateMany({
      where: {
        id: generationId,
        OR: [
          {
            status: PlanGenerationStatus.QUEUED,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: new Date() } }],
          },
          {
            status: PlanGenerationStatus.PROCESSING,
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }],
          },
        ],
      },
      data: { status: PlanGenerationStatus.PROCESSING, leaseOwner, leaseExpiresAt, error: null },
    });
    if (!claimed.count) {
      await this.client.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: msg.ReceiptHandle,
          VisibilityTimeout: 60,
        }),
      );
      return;
    }
    job = await this.prisma.planGenerationJob.findFirstOrThrow({
      where: { id: generationId, leaseOwner },
    });
    const heartbeat = setInterval(() => {
      void this.prisma.planGenerationJob
        .updateMany({
          where: { id: generationId, status: PlanGenerationStatus.PROCESSING, leaseOwner },
          data: { leaseExpiresAt: new Date(Date.now() + VISIBILITY_TIMEOUT_SECONDS * 1000) },
        })
        .then(async ({ count }) => {
          if (count)
            await this.client.send(
              new ChangeMessageVisibilityCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
                VisibilityTimeout: VISIBILITY_TIMEOUT_SECONDS,
              }),
            );
        })
        .catch((error) => this.logger.warn(`Generation heartbeat ${generationId}: ${error}`));
    }, 60_000);
    heartbeat.unref();
    try {
      // The persisted payload is authoritative; duplicate/stale messages cannot replace it.
      const input = job.payload as unknown as PlanFromHealthDto & {
        resumeWindow?: ResumePlanningWindow;
      };
      if (input.resumeWindow) {
        await this.aiPlannerService.planFromHealth(
          userId,
          input,
          generationId,
          leaseOwner,
          input.resumeWindow,
        );
      } else {
        await this.aiPlannerService.planFromHealth(userId, input, generationId, leaseOwner);
      }
      await this.deleteMessage(msg.ReceiptHandle);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const attempts = job.attempts + 1;
      const failed = err instanceof ResumeWindowExpiredError || attempts >= 3;
      const updated = await this.prisma.planGenerationJob.updateMany({
        where: { id: generationId, status: PlanGenerationStatus.PROCESSING, leaseOwner },
        data: {
          status: failed ? PlanGenerationStatus.FAILED : PlanGenerationStatus.QUEUED,
          error: message,
          attempts,
          leaseOwner: null,
          leaseExpiresAt: failed ? null : new Date(Date.now() + 30 * attempts * 1000),
        },
      });
      if (updated.count) {
        if (failed) await this.deleteMessage(msg.ReceiptHandle);
        else
          await this.client.send(
            new ChangeMessageVisibilityCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
              VisibilityTimeout: 30 * attempts,
            }),
          );
      }
      this.logger.error(`Plan generation ${generationId} failed: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }),
    );
  }
}
