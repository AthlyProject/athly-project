/**
 * Montagem determinística da meta a partir das respostas estruturadas, compartilhada pelo
 * onboarding (`POST /assessment`), pela troca de meta (`PUT /goals/active`) e pela análise de uma
 * meta em rascunho. O parser de texto livre por IA foi removido e é desnecessário aqui.
 */
import { CodedBadRequestException } from '../../common/errors/coded-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { ParsedGoal } from '../ai-planner/prompts/goal-parser-prompt';
import { parseTargetDistanceMeters, parseTargetTimeSeconds } from '../ai-planner/goal-feasibility';

const DAY_MS = 24 * 60 * 60 * 1000;
// Prova mais distante aceita (~3 anos).
const MAX_EVENT_HORIZON_DAYS = 3 * 366;

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Respostas de meta do onboarding (o objetivo pessoal tem distância, tipo, tempo e data). */
export interface GoalAnswers {
  objective?: string;
  objectiveDistance?: string;
  objectiveType?: string;
  targetTime?: string;
  eventDate?: string;
}

export function buildParsedGoal(
  answers: GoalAnswers,
  eventDate: string | null,
  experienceLevel: ExperienceLevel | null,
): ParsedGoal {
  // "Melhorar fitness e endurance" — objetivo aberto, sem distância/tempo alvo.
  if (answers.objective !== 'personal') {
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
  const targetDistance = answers.objectiveDistance?.trim() || null;
  const targetTime =
    answers.objectiveType === 'target_time' && answers.targetTime?.trim()
      ? answers.targetTime.trim()
      : null;

  const label = targetDistance ? distanceLabel(targetDistance) : 'corrida';
  const summary = targetTime ? `Treinar para ${label} em ${targetTime}` : `Treinar para ${label}`;

  return {
    isRunningRelated: true,
    targetDistance,
    targetTime,
    eventDate,
    eventName: null,
    experienceLevel,
    summary,
    rejectionReason: null,
  };
}

/**
 * Data da prova do objetivo pessoal: data civil real, de hoje (UTC) até ~3 anos à frente.
 * O app só oferece datas a partir de amanhã no fuso do aparelho, então "hoje em UTC" já
 * cobre a diferença de fuso. No objetivo de fitness a data é ignorada.
 */
export function resolveEventDate(answers: GoalAnswers): string | null {
  if (answers.objective !== 'personal' || !answers.eventDate) return null;

  const [year, month, day] = answers.eventDate.split('-').map(Number);
  const eventMs = Date.UTC(year, month - 1, day);
  const parsed = new Date(eventMs);
  const isCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysAhead = (eventMs - todayMs) / DAY_MS;

  if (!isCalendarDate || daysAhead < 0 || daysAhead > MAX_EVENT_HORIZON_DAYS) {
    throw new CodedBadRequestException(
      ErrorCode.ASSESSMENT_EVENT_DATE_INVALID,
      'Escolha uma data de prova futura, em até 3 anos.',
    );
  }
  return answers.eventDate;
}

/**
 * Tempo alvo das metas novas (troca de meta e análise de rascunho): legível e com um pace entre
 * 2 e 15 min/km, os limites do motor objetivo. "3:30" numa maratona viraria 3,5 minutos. O
 * onboarding (`POST /assessment`) mantém o contrato atual e não passa por aqui.
 */
export function validateTargetTime(answers: GoalAnswers): void {
  if (answers.objectiveType !== 'target_time') return;
  const seconds = parseTargetTimeSeconds(answers.targetTime);
  const meters = parseTargetDistanceMeters(answers.objectiveDistance);
  const pace = seconds && meters ? (seconds * 1000) / meters : null;
  if (seconds === null || (pace !== null && (pace < 120 || pace > 900))) {
    throw new CodedBadRequestException(
      ErrorCode.GOAL_TARGET_TIME_INVALID,
      'Confira o tempo alvo: use h:mm:ss ou mm:ss, com um ritmo entre 2 e 15 min/km.',
    );
  }
}

export function mapExperienceLevel(fitnessLevel?: string | null): ExperienceLevel | null {
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

export function distanceLabel(value: string): string {
  const labels: Record<string, string> = {
    '5k': '5K',
    '10k': '10K',
    '15k': '15K',
    half: 'meia maratona',
    '42k': 'maratona',
    ultra: 'ultra',
  };
  return labels[value.toLowerCase()] ?? value;
}

/**
 * Linhas do esqueleto do macrociclo (PLANNED com fase, sem treinos) do plano do usuário. Saem
 * quando a meta muda: o esqueleto é gravado na primeira geração e nunca é refeito, então a meta
 * nova herdaria as fases e os volumes da antiga. Semanas entregues (GENERATED/LOCKED) ficam, e a
 * reserva de uma geração em andamento (PLANNED com métricas vazias) também.
 */
export function staleSkeletonWhere(userId: string) {
  return {
    trainingPlan: { userId },
    status: 'PLANNED' as const,
    workouts: { none: {} },
    NOT: { metrics: { equals: {} } },
  };
}
