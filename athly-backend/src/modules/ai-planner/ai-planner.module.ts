import { Module } from '@nestjs/common';
import { AiPlannerController } from './ai-planner.controller';
import { AiPlannerService } from './ai-planner.service';
import { GeminiService } from './gemini.service';
import { WorkoutExecutionAnalyzerService } from './workout-execution-analyzer.service';
import { EffortZoneModule } from '../effort-zones/effort-zone.module';
import { BillingModule } from '../billing/billing.module';
import { TrainingReportModule } from '../training-report/training-report.module';
import { PlanGenerationSqsService } from './plan-generation-sqs.service';
import { PlanGenerationSqsConsumer } from './plan-generation-sqs.consumer';

@Module({
  imports: [EffortZoneModule, BillingModule, TrainingReportModule],
  controllers: [AiPlannerController],
  providers: [
    AiPlannerService,
    GeminiService,
    WorkoutExecutionAnalyzerService,
    PlanGenerationSqsService,
    PlanGenerationSqsConsumer,
  ],
  exports: [GeminiService],
})
export class AiPlannerModule {}
