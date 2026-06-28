import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  computeLongitudinalWeeks,
  computePreviousWeekAnalysis,
} from '../ai-planner/weekly-metrics.util';
import type { GoalFeasibility } from '../ai-planner/goal-feasibility';
import type { TrainingReport } from './types';

const REPORT_WEEKS = 4;

@Injectable()
export class TrainingReportService {
  private readonly logger = new Logger(TrainingReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Captures a laudo from the last (up to 4) weekly goals of a plan and stores it
   * on the user, so the next plan's first generation isn't a cold start. No-op when
   * the plan has no weekly goals. Called right before the plan is deleted (cascade).
   */
  async captureFromPlan(userId: string, planId: string): Promise<void> {
    const goals = await this.prisma.weeklyGoal.findMany({
      where: { trainingPlanId: planId },
      orderBy: { weekStartDate: 'desc' },
      take: REPORT_WEEKS,
      include: { workouts: { include: { feedback: true } } },
    });
    if (goals.length === 0) return;

    const plan = await this.prisma.trainingPlan.findUnique({
      where: { id: planId },
      select: { objective: true, targetDate: true, userGoalId: true },
    });

    const latestMetrics = (goals[0].metrics ?? {}) as { fitnessInsights?: string; trend?: string };
    const finalInsights =
      latestMetrics.fitnessInsights || latestMetrics.trend
        ? {
            fitnessInsights: latestMetrics.fitnessInsights ?? null,
            trend: latestMetrics.trend ?? null,
          }
        : null;

    let feasibility: GoalFeasibility | null = null;
    if (plan?.userGoalId) {
      const goal = await this.prisma.userGoal.findUnique({
        where: { id: plan.userGoalId },
        select: { feasibility: true },
      });
      feasibility = (goal?.feasibility as unknown as GoalFeasibility) ?? null;
    }

    const report: TrainingReport = {
      sourcePlanId: planId,
      objective: plan?.objective ?? '',
      targetDate: plan?.targetDate ? plan.targetDate.toISOString().split('T')[0] : null,
      longitudinalWeeks: computeLongitudinalWeeks(goals),
      previousWeekAnalysis: computePreviousWeekAnalysis(goals),
      finalInsights,
      feasibility,
      generatedAt: new Date().toISOString(),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastTrainingReport: report as unknown as Prisma.InputJsonValue,
        lastTrainingReportAt: new Date(),
      },
    });
    this.logger.log(
      `Captured training report for user ${userId} from plan ${planId} (${goals.length} week(s)).`,
    );
  }

  /** Reads the stored laudo without clearing it (clear only after a successful generation). */
  async getForUser(userId: string): Promise<TrainingReport | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastTrainingReport: true },
    });
    return (user?.lastTrainingReport as unknown as TrainingReport) ?? null;
  }

  /** Clears the laudo once it has been consumed by a new plan's first generation. */
  async clearForUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastTrainingReport: Prisma.JsonNull, lastTrainingReportAt: null },
    });
  }
}
