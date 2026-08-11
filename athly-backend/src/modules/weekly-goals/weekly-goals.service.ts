import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WeeklyGoalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateWeeklyGoalDto } from './dto/create-weekly-goal.dto';
import { UpdateWeeklyGoalDto } from './dto/update-weekly-goal.dto';
import { WeeklyGoalModel } from './models/weekly-goal.model';
import { AdminWeeklyReportModel } from './models/admin-weekly-report.model';

@Injectable()
export class WeeklyGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async createWeeklyGoal(userId: string, input: CreateWeeklyGoalDto): Promise<WeeklyGoalModel> {
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id: input.trainingPlanId },
    });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Training plan not found');
    }

    const weeklyGoal = await this.prisma.weeklyGoal.create({
      data: {
        trainingPlanId: input.trainingPlanId,
        weekStartDate: new Date(input.weekStartDate),
        weekEndDate: new Date(input.weekEndDate),
        metrics: (input.metrics ?? {}) as Prisma.InputJsonValue,
      },
    });

    return this.mapWeeklyGoal({
      id: weeklyGoal.id,
      trainingPlanId: weeklyGoal.trainingPlanId,
      weekStartDate: weeklyGoal.weekStartDate,
      weekEndDate: weeklyGoal.weekEndDate,
      status: weeklyGoal.status,
      metrics: weeklyGoal.metrics,
      createdAt: weeklyGoal.createdAt,
      updatedAt: weeklyGoal.updatedAt,
    });
  }

  async getWeeklyGoalsByTrainingPlan(
    userId: string,
    trainingPlanId: string,
  ): Promise<WeeklyGoalModel[]> {
    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
    });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Training plan not found');
    }

    const weeklyGoals = await this.prisma.weeklyGoal.findMany({
      where: { trainingPlanId },
      orderBy: { weekStartDate: 'asc' },
    });

    return weeklyGoals.map((wg) =>
      this.mapWeeklyGoal({
        ...wg,
        previousWeekAnalysis: wg.previousWeekAnalysis ?? undefined,
      }),
    );
  }

  async getWeeklyGoalById(userId: string, id: string): Promise<WeeklyGoalModel> {
    const weeklyGoal = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      include: { trainingPlan: true },
    });

    if (!weeklyGoal || weeklyGoal.trainingPlan.userId !== userId) {
      throw new NotFoundException('Weekly goal not found');
    }

    return this.mapWeeklyGoal({
      id: weeklyGoal.id,
      trainingPlanId: weeklyGoal.trainingPlanId,
      weekStartDate: weeklyGoal.weekStartDate,
      weekEndDate: weeklyGoal.weekEndDate,
      status: weeklyGoal.status,
      metrics: weeklyGoal.metrics as Record<string, unknown>,
      createdAt: weeklyGoal.createdAt,
      updatedAt: weeklyGoal.updatedAt,
    });
  }

  async updateWeeklyGoal(
    userId: string,
    id: string,
    input: UpdateWeeklyGoalDto,
  ): Promise<WeeklyGoalModel> {
    const existing = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      include: { trainingPlan: true },
    });
    if (!existing || existing.trainingPlan.userId !== userId) {
      throw new NotFoundException('Weekly goal not found');
    }

    const updateData: Prisma.WeeklyGoalUpdateInput = {};
    if (input.weekStartDate !== undefined) {
      updateData.weekStartDate = new Date(input.weekStartDate);
    }
    if (input.weekEndDate !== undefined) {
      updateData.weekEndDate = new Date(input.weekEndDate);
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.metrics !== undefined) {
      updateData.metrics = input.metrics as Prisma.InputJsonValue;
    }

    const weeklyGoal = await this.prisma.weeklyGoal.update({
      where: { id },
      data: updateData,
    });

    return this.mapWeeklyGoal({
      id: weeklyGoal.id,
      trainingPlanId: weeklyGoal.trainingPlanId,
      weekStartDate: weeklyGoal.weekStartDate,
      weekEndDate: weeklyGoal.weekEndDate,
      status: weeklyGoal.status,
      metrics: weeklyGoal.metrics,
      createdAt: weeklyGoal.createdAt,
      updatedAt: weeklyGoal.updatedAt,
    });
  }

  async getAdminReport(userId: string, id: string): Promise<AdminWeeklyReportModel> {
    const weeklyGoal = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      include: {
        trainingPlan: true,
        promptLog: true,
        workouts: {
          where: { status: { in: ['done', 'partial'] } },
          orderBy: { dateScheduled: 'asc' },
        },
      },
    });

    if (!weeklyGoal || weeklyGoal.trainingPlan.userId !== userId) {
      throw new NotFoundException('Weekly goal not found');
    }

    return {
      id: weeklyGoal.id,
      weekStartDate: weeklyGoal.weekStartDate,
      weekEndDate: weeklyGoal.weekEndDate,
      metrics: (weeklyGoal.metrics as Record<string, unknown> | undefined) ?? undefined,
      previousWeekAnalysis:
        (weeklyGoal.previousWeekAnalysis as Record<string, unknown> | undefined) ?? undefined,
      promptLog: weeklyGoal.promptLog
        ? {
            promptText: weeklyGoal.promptLog.promptText,
            rawResponse: weeklyGoal.promptLog.rawResponse,
            parsedResponse:
              (weeklyGoal.promptLog.parsedResponse as Record<string, unknown> | null) ?? null,
            modelUsed: weeklyGoal.promptLog.modelUsed,
            promptVersion: weeklyGoal.promptLog.promptVersion,
            generationType: weeklyGoal.promptLog.generationType,
            createdAt: weeklyGoal.promptLog.createdAt,
          }
        : null,
      workouts: weeklyGoal.workouts.map((w) => ({
        id: w.id,
        dateScheduled: w.dateScheduled,
        title: w.title,
        description: w.description ?? null,
        status: w.status,
        actualDistanceMeters: w.actualDistanceMeters ?? null,
        actualDurationSeconds: w.actualDurationSeconds ?? null,
      })),
    };
  }

  async deleteWeeklyGoal(userId: string, id: string): Promise<void> {
    const weeklyGoal = await this.prisma.weeklyGoal.findUnique({
      where: { id },
      include: { trainingPlan: true },
    });
    if (!weeklyGoal || weeklyGoal.trainingPlan.userId !== userId) {
      throw new NotFoundException('Weekly goal not found');
    }

    await this.prisma.weeklyGoal.delete({
      where: { id },
    });
  }

  private mapWeeklyGoal(weeklyGoal: {
    id: string;
    trainingPlanId: string;
    weekStartDate: Date;
    weekEndDate: Date;
    status: WeeklyGoalModel['status'];
    metrics: unknown;
    previousWeekAnalysis?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): WeeklyGoalModel {
    return {
      id: weeklyGoal.id,
      trainingPlanId: weeklyGoal.trainingPlanId,
      weekStartDate: weeklyGoal.weekStartDate,
      weekEndDate: weeklyGoal.weekEndDate,
      status: weeklyGoal.status,
      metrics: (weeklyGoal.metrics as Record<string, unknown> | undefined) ?? undefined,
      previousWeekAnalysis:
        (weeklyGoal.previousWeekAnalysis as Record<string, unknown> | undefined) ?? undefined,
      createdAt: weeklyGoal.createdAt,
      updatedAt: weeklyGoal.updatedAt,
    };
  }
}
