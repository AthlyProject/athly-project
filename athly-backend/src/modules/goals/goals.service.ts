import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveGoal(userId: string) {
    const goal = await this.prisma.userGoal.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!goal) return null;

    return {
      id: goal.id,
      rawText: goal.rawText,
      parsedGoal: goal.parsedGoal,
      feasibility: goal.feasibility,
      active: goal.active,
      createdAt: goal.createdAt,
    };
  }

  async listGoals(userId: string) {
    const goals = await this.prisma.userGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((g) => ({
      id: g.id,
      rawText: g.rawText,
      parsedGoal: g.parsedGoal,
      feasibility: g.feasibility,
      active: g.active,
      createdAt: g.createdAt,
    }));
  }
}
