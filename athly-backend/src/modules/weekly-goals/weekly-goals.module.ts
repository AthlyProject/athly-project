import { Module } from '@nestjs/common';
import { WeeklyGoalsService } from './weekly-goals.service';
import { WeeklyGoalsController } from './weekly-goals.controller';
import { AdminEmailGuard } from '../auth/guards/admin-email.guard';

@Module({
  controllers: [WeeklyGoalsController],
  providers: [WeeklyGoalsService, AdminEmailGuard],
  exports: [WeeklyGoalsService],
})
export class WeeklyGoalsModule {}
