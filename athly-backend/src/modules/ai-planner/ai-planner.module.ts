import { Module } from '@nestjs/common';
import { AiPlannerController } from './ai-planner.controller';
import { AiPlannerService } from './ai-planner.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  controllers: [AiPlannerController],
  providers: [AiPlannerService, StravaService, GeminiService],
})
export class AiPlannerModule {}
