import { Injectable, Logger } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

export const PLAN_GENERATION_QUEUE = 'training-plan-generation';

export interface PlanGenerationMessageBody {
  generationId: string;
  userId: string;
  input: Record<string, unknown>;
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
