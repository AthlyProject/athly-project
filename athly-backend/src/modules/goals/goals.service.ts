import { Injectable } from '@nestjs/common';
import { PlanGenerationStatus, Prisma, TrainingPlanStatus, type UserGoal } from '@prisma/client';
import { CodedConflictException } from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';
import type { GoalDraftDto } from './dto/goal-draft.dto';
import {
  buildParsedGoal,
  mapExperienceLevel,
  resolveEventDate,
  staleSkeletonWhere,
  validateTargetTime,
} from './goal-builder';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveGoal(userId: string) {
    const goal = await this.prisma.userGoal.findFirst({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!goal) return null;

    return present(goal);
  }

  async listGoals(userId: string) {
    const goals = await this.prisma.userGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map(present);
  }

  /**
   * Troca a meta ativa (alternativa aceita na análise, ou meta nova no meio do ciclo). Vale para
   * as próximas semanas geradas: as já entregues ficam, e o esqueleto de fases da meta antiga sai
   * para a próxima geração montar o macrociclo novo a partir desta semana.
   */
  async replaceActiveGoal(userId: string, draft: GoalDraftDto) {
    const answers = { objective: 'personal', ...draft };
    const eventDate = resolveEventDate(answers);
    validateTargetTime(answers);
    const goal = await this.prisma.$transaction(async (tx) => {
      // A mesma trava da automação semanal: a troca não cruza a reserva de uma geração.
      await tx.$queryRaw`SELECT id FROM training_plans WHERE user_id = ${userId} FOR NO KEY UPDATE`;
      const activeJob = await tx.planGenerationJob.findFirst({
        where: {
          userId,
          status: { in: [PlanGenerationStatus.QUEUED, PlanGenerationStatus.PROCESSING] },
        },
        select: { id: true },
      });
      if (activeJob) {
        throw new CodedConflictException(
          ErrorCode.GOAL_CHANGE_GENERATION_IN_PROGRESS,
          'Seu plano está sendo gerado. Aguarde a conclusão para trocar a meta.',
        );
      }
      const plan = await tx.trainingPlan.findUnique({
        where: { userId },
        select: { status: true },
      });
      if (plan?.status === TrainingPlanStatus.LOCKED) {
        throw new CodedConflictException(
          ErrorCode.TRAINING_PLAN_LOCKED,
          'Seu plano está bloqueado e não aceita troca de meta.',
        );
      }
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { fitnessLevel: true },
      });
      const parsedGoal = buildParsedGoal(
        answers,
        eventDate,
        mapExperienceLevel(user?.fitnessLevel),
      );
      await tx.userGoal.updateMany({ where: { userId, active: true }, data: { active: false } });
      const created = await tx.userGoal.create({
        data: {
          userId,
          rawText: parsedGoal.summary,
          parsedGoal: parsedGoal as unknown as Prisma.InputJsonValue,
          active: true,
        },
      });
      await tx.weeklyGoal.deleteMany({ where: staleSkeletonWhere(userId) });
      // A geração religa a meta ao plano, mas nunca limpa a data de uma meta sem prova.
      await tx.trainingPlan.updateMany({
        where: { userId, status: { in: [TrainingPlanStatus.ACTIVE, TrainingPlanStatus.DRAFT] } },
        data: {
          userGoalId: created.id,
          objective: parsedGoal.summary,
          targetDate: eventDate ? new Date(eventDate) : null,
        },
      });
      return created;
    });
    return present(goal);
  }
}

function present(goal: UserGoal) {
  return {
    id: goal.id,
    rawText: goal.rawText,
    parsedGoal: goal.parsedGoal,
    feasibility: goal.feasibility,
    active: goal.active,
    createdAt: goal.createdAt,
  };
}
