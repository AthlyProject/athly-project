import { Module } from '@nestjs/common';
import { TrainingReportService } from './training-report.service';

/**
 * Owns the "laudo" lifecycle (capture on plan delete, consume on plan create).
 * Depends only on the global PrismaModule, so both TrainingPlansModule and
 * AiPlannerModule can import it without creating a dependency cycle.
 */
@Module({
  providers: [TrainingReportService],
  exports: [TrainingReportService],
})
export class TrainingReportModule {}
