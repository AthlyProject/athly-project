import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { PrismaModule } from '../../database/prisma.module';
import { AiPlannerModule } from '../ai-planner/ai-planner.module';

@Module({
  imports: [PrismaModule, AiPlannerModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
