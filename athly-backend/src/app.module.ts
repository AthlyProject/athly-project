import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { RunsModule } from './modules/runs/runs.module';
import { EquipmentsModule } from './modules/equipments/equipments.module';
import { WeeklyGoalsModule } from './modules/weekly-goals/weekly-goals.module';
import { TrainingPlansModule } from './modules/training-plans/training-plans.module';
import { AiPlannerModule } from './modules/ai-planner/ai-planner.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { EffortZoneModule } from './modules/effort-zones/effort-zone.module';
import { GoalsModule } from './modules/goals/goals.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
    AuthModule,
    UsersModule,
    WorkoutsModule,
    RunsModule,
    EquipmentsModule,
    WeeklyGoalsModule,
    TrainingPlansModule,
    AiPlannerModule,
    AssessmentModule,
    EffortZoneModule,
    GoalsModule,
    WaitlistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
