import { Module } from '@nestjs/common';
import { AiPlannerController } from './ai-planner.controller';
import { AiPlannerService } from './ai-planner.service';
import { GeminiService } from './gemini.service';
import { WorkoutExecutionAnalyzerService } from './workout-execution-analyzer.service';
import { EffortZoneModule } from '../effort-zones/effort-zone.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [EffortZoneModule, AssessmentModule, BillingModule],
  controllers: [AiPlannerController],
  providers: [AiPlannerService, GeminiService, WorkoutExecutionAnalyzerService],
  exports: [GeminiService],
})
export class AiPlannerModule {}
