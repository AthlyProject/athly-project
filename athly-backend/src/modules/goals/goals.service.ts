import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GeminiService } from '../ai-planner/gemini.service';
import { CreateGoalDto } from './dto/create-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  async createGoal(userId: string, dto: CreateGoalDto) {
    const parsedGoal = await this.geminiService.parseGoal(dto.goalText);

    if (!parsedGoal.isRunningRelated) {
      throw new UnprocessableEntityException(
        parsedGoal.rejectionReason ??
          'No momento o Athly é focado em corrida. Reformule seu objetivo para incluir corrida.',
      );
    }

    // Deactivate previous active goals
    await this.prisma.userGoal.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    const goal = await this.prisma.userGoal.create({
      data: {
        userId,
        rawText: dto.goalText,
        parsedGoal: parsedGoal as any,
        active: true,
      },
    });

    return {
      id: goal.id,
      rawText: goal.rawText,
      parsedGoal: goal.parsedGoal,
      active: goal.active,
      createdAt: goal.createdAt,
    };
  }

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
      active: g.active,
      createdAt: g.createdAt,
    }));
  }
}
