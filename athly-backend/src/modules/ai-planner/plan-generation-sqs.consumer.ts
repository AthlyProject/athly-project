import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
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
      this.logger.error(`Malformed SQS message body — deleting: ${msg.Body}`);
      await this.deleteMessage(msg.ReceiptHandle!);
      return;
    }

    const { generationId, userId, input } = body;
    this.logger.log(`Processing plan generation ${generationId} for user ${userId}`);

    await this.prisma.planGenerationJob.updateMany({
      where: { id: generationId },
      data: { status: PlanGenerationStatus.PROCESSING, error: null },
    });

    try {
      await this.aiPlannerService.planFromHealth(
        userId,
        input as unknown as PlanFromHealthDto,
        generationId,
      );
      await this.deleteMessage(msg.ReceiptHandle!);
      this.logger.log(`Plan generation ${generationId} completed — message deleted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Plan generation ${generationId} failed: ${message}`);

      const job = await this.prisma.planGenerationJob.findUnique({
        where: { id: generationId },
        select: { attempts: true },
      });
      const attempts = (job?.attempts ?? 0) + 1;
      const maxAttempts = 3;

      if (attempts >= maxAttempts) {
        await this.prisma.planGenerationJob.updateMany({
          where: { id: generationId },
          data: { status: PlanGenerationStatus.FAILED, error: message, attempts },
        });
        // Delete da fila para evitar reprocessamento; falha final registrada no DB
        await this.deleteMessage(msg.ReceiptHandle!);
      } else {
        await this.prisma.planGenerationJob.updateMany({
          where: { id: generationId },
          data: { status: PlanGenerationStatus.QUEUED, error: message, attempts },
        });
        // Retorna a mensagem para a fila com backoff exponencial (30s, 60s, ...)
        const delay = 30 * attempts;
        await this.client.send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: msg.ReceiptHandle!,
            VisibilityTimeout: delay,
          }),
        );
      }
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }),
    );
  }
}
