import { Module } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { WorkoutsController } from './workouts.controller';

import { AiPlannerModule } from '../ai-planner/ai-planner.module';

@Module({
  imports: [AiPlannerModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
})
export class WorkoutsModule {}
