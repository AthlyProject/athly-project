import { Module } from '@nestjs/common';
import { AiPlannerController } from './ai-planner.controller';
import { AiPlannerService } from './ai-planner.service';
import { StravaService } from './strava.service';
import { GeminiService } from './gemini.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EffortZoneModule } from '../effort-zones/effort-zone.module';
import { AssessmentModule } from '../assessment/assessment.module';

@Module({
  imports: [IntegrationsModule, EffortZoneModule, AssessmentModule],
  controllers: [AiPlannerController],
  providers: [AiPlannerService, StravaService, GeminiService],
  exports: [GeminiService],
})
export class AiPlannerModule {}
