import { Injectable } from '@nestjs/common';
import { PlanGenerationStatus } from '@prisma/client';
import { CodedConflictException } from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';
import {
  buildParsedGoal,
  mapExperienceLevel,
  resolveEventDate,
  staleSkeletonWhere,
} from '../goals/goal-builder';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

@Injectable()
export class AssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fecha o onboarding: grava o perfil no usuário e transforma as respostas
   * estruturadas em uma `UserGoal` ativa. As primeiras corridas são geradas
   * depois, quando o app chama `plan-from-health` (com os dados do Apple Health).
   */
  async submit(userId: string, dto: SubmitAssessmentDto) {
    if (!dto.termsAccepted) {
      throw new CodedConflictException(
        ErrorCode.ASSESSMENT_TERMS_NOT_ACCEPTED,
        'Você precisa aceitar os termos para continuar.',
      );
    }
    const eventDate = resolveEventDate(dto);

    const activeJob = await this.prisma.planGenerationJob.findFirst({
      where: {
        userId,
        status: { in: [PlanGenerationStatus.QUEUED, PlanGenerationStatus.PROCESSING] },
      },
    });
    if (activeJob) {
      throw new CodedConflictException(
        ErrorCode.ASSESSMENT_PLAN_GENERATION_IN_PROGRESS,
        'Seu plano está sendo gerado. Aguarde a conclusão antes de iniciar uma nova avaliação.',
      );
    }

    const parsedGoal = buildParsedGoal(dto, eventDate, mapExperienceLevel(dto.fitnessLevel));

    const [, , goal] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          gender: dto.gender ?? undefined,
          weight: dto.weight ?? undefined,
          height: dto.height ?? undefined,
          fitnessLevel: dto.fitnessLevel ?? undefined,
          comfortPaceSeconds: dto.comfortPaceSeconds ?? undefined,
          restingHeartRate: dto.restingHeartRate ?? undefined,
          maxHeartRate: dto.maxHeartRate ?? undefined,
          // Vazio → mantém o fallback do planner (DEFAULT_AVAILABLE_DAYS).
          availableDays: dto.availableDays?.length ? dto.availableDays : undefined,
          assessmentCompleted: true,
        },
      }),
      // Só um objetivo ativo por vez: desativa os anteriores antes de criar o novo.
      this.prisma.userGoal.updateMany({
        where: { userId, active: true },
        data: { active: false },
      }),
      this.prisma.userGoal.create({
        data: {
          userId,
          rawText: parsedGoal.summary,
          parsedGoal: parsedGoal as unknown as object,
          active: true,
        },
      }),
      // Refazer a avaliação com plano existente: as fases futuras seguem a meta nova.
      this.prisma.weeklyGoal.deleteMany({ where: staleSkeletonWhere(userId) }),
    ]);

    return goal;
  }
}
