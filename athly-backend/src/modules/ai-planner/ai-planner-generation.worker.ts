import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AiPlannerService } from './ai-planner.service';

@Injectable()
export class AiPlannerGenerationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AiPlannerGenerationWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly aiPlannerService: AiPlannerService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
    void this.tick();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      await this.aiPlannerService.drainGenerationQueue();
    } catch (error) {
      this.logger.error(
        `Falha ao drenar fila de geração: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
