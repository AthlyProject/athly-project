import { Injectable, ConflictException } from '@nestjs/common';
import { PlanGenerationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import type { ParsedGoal } from '../ai-planner/prompts/goal-parser-prompt';

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
      throw new ConflictException('Você precisa aceitar os termos para continuar.');
    }

    const activeJob = await this.prisma.planGenerationJob.findFirst({
      where: {
        userId,
        status: { in: [PlanGenerationStatus.QUEUED, PlanGenerationStatus.PROCESSING] },
      },
    });
    if (activeJob) {
      throw new ConflictException(
        'Seu plano está sendo gerado. Aguarde a conclusão antes de iniciar uma nova avaliação.',
      );
    }

    const parsedGoal = this.buildParsedGoal(dto);

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
    ]);

    return goal;
  }

  /**
   * Monta o `ParsedGoal` de forma determinística a partir das respostas já
   * estruturadas — o parser de texto livre por IA foi removido e é desnecessário aqui.
   */
  private buildParsedGoal(dto: SubmitAssessmentDto): ParsedGoal {
    const experienceLevel = this.mapExperienceLevel(dto.fitnessLevel);

    // "Melhorar fitness e endurance" — objetivo aberto, sem distância/tempo alvo.
    if (dto.objective !== 'personal') {
      return {
        isRunningRelated: true,
        targetDistance: null,
        targetTime: null,
        eventDate: null,
        eventName: null,
        experienceLevel,
        summary: 'Melhorar fitness e endurance',
        rejectionReason: null,
      };
    }

    // Objetivo pessoal: distância definida e (opcionalmente) tempo alvo.
    const targetDistance = dto.objectiveDistance?.trim() || null;
    const targetTime =
      dto.objectiveType === 'target_time' && dto.targetTime?.trim() ? dto.targetTime.trim() : null;

    const distanceLabel = targetDistance ? this.distanceLabel(targetDistance) : 'corrida';
    const summary = targetTime
      ? `Treinar para ${distanceLabel} em ${targetTime}`
      : `Treinar para ${distanceLabel}`;

    return {
      isRunningRelated: true,
      targetDistance,
      targetTime,
      eventDate: null,
      eventName: null,
      experienceLevel,
      summary,
      rejectionReason: null,
    };
  }

  private mapExperienceLevel(
    fitnessLevel?: string,
  ): 'beginner' | 'intermediate' | 'advanced' | null {
    switch (fitnessLevel) {
      case 'beginning':
      case 'beginner':
        return 'beginner';
      case 'hobby':
      case 'intermediate':
        return 'intermediate';
      case 'advanced':
      case 'pro':
        return 'advanced';
      default:
        return null;
    }
  }

  private distanceLabel(value: string): string {
    const labels: Record<string, string> = {
      '5k': '5K',
      '10k': '10K',
      half: 'meia maratona',
      '42k': 'maratona',
      ultra: 'ultra',
    };
    return labels[value.toLowerCase()] ?? value;
  }
}
