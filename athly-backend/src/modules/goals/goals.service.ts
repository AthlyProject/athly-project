import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GeminiService } from '../ai-planner/gemini.service';
import type { ParsedGoal } from '../ai-planner/prompts/goal-parser-prompt';
import { assessGoalFeasibility, type GoalFeasibility } from '../ai-planner/goal-feasibility';
import { DEFAULT_VDOT } from '../effort-zones/vdot-calculator';
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

    // Best-effort feasibility at goal-set time. Refined later by the weekly
    // generation once fresh runs sharpen the VDOT estimate.
    const feasibility = await this.computeFeasibility(userId, parsedGoal);

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
        feasibility: (feasibility ?? undefined) as any,
        active: true,
      },
    });

    return {
      id: goal.id,
      rawText: goal.rawText,
      parsedGoal: goal.parsedGoal,
      feasibility: goal.feasibility,
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

  /**
   * Computes feasibility for a dated, quantifiable goal using the athlete's most
   * recent VDOT. Falls back to DEFAULT_VDOT (flagged lowConfidence) on a cold
   * start so the user still gets a directional verdict before logging any runs.
   * Returns null when the goal has no date or unparseable distance/time.
   */
  private async computeFeasibility(
    userId: string,
    parsedGoal: ParsedGoal,
  ): Promise<GoalFeasibility | null> {
    if (!parsedGoal.eventDate) return null;

    const zone = await this.prisma.userEffortZone.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { vdotScore: true },
    });
    const currentVdot = zone?.vdotScore ?? DEFAULT_VDOT;
    const lowConfidence = !zone?.vdotScore;

    return assessGoalFeasibility({
      goal: {
        targetDistance: parsedGoal.targetDistance,
        targetTime: parsedGoal.targetTime,
        eventDate: parsedGoal.eventDate,
        experienceLevel: parsedGoal.experienceLevel,
      },
      currentVdot,
      asOfISO: new Date().toISOString().split('T')[0],
      lowConfidence,
    });
  }
}
