import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export const PLAN_GENERATION_QUEUE = 'training-plan-generation';

export interface PlanGenerationMessageBody {
  generationId: string;
  userId: string;
  input?: Record<string, unknown>;
}

/**
 * Backend rodando na máquina do dev, sem fila: `PlanGenerationLocalWorker` processa os jobs
 * direto do banco. Exige opt-in explícito e nunca liga em produção ou com SQS configurado.
 */
export function isLocalPlanGenerationEnabled(): boolean {
  return (
    process.env.PLAN_GENERATION_INLINE === 'true' &&
    !process.env.AWS_SQS_PLAN_GENERATION_QUEUE_URL &&
    process.env.NODE_ENV !== 'production'
  );
}

@Injectable()
export class PlanGenerationSqsService {
  private readonly logger = new Logger(PlanGenerationSqsService.name);
  private readonly client: SQSClient;
  readonly queueUrl: string;

  constructor() {
    this.client = new SQSClient({ region: process.env.AWS_REGION });
    this.queueUrl = process.env.AWS_SQS_PLAN_GENERATION_QUEUE_URL ?? '';

    if (!this.queueUrl) {
      this.logger.warn(
        'AWS_SQS_PLAN_GENERATION_QUEUE_URL is not set — plan generation queue is disabled',
      );
    }
  }

  async send(body: PlanGenerationMessageBody): Promise<void> {
    if (!this.queueUrl) {
      throw new Error('SQS queue URL is not configured (AWS_SQS_PLAN_GENERATION_QUEUE_URL)');
    }

    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(body),
      }),
    );

    this.logger.log(`Queued plan generation job ${body.generationId} for user ${body.userId}`);
  }
}
