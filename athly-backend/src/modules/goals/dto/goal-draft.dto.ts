import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CodedBadRequestException } from '../../../common/errors/coded-exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import {
  parseTargetDistanceMeters,
  parseTargetTimeSeconds,
} from '../../ai-planner/goal-feasibility';

export class InterpretGoalDto {
  @IsString() @Length(1, 500) goalText!: string;
}

export class GoalDraftDto {
  @IsOptional() @IsString() @MaxLength(500) rawText?: string;
  @IsString() @Length(1, 500) summary!: string;
  @IsOptional() @IsString() targetDistance?: string | null;
  @IsOptional() @IsString() targetTime?: string | null;
  @IsOptional() @IsString() eventDate?: string | null;
  @IsOptional() @IsString() @MaxLength(200) eventName?: string | null;
}

export function normalizeGoalDraft(goal: GoalDraftDto): GoalDraftDto {
  if (!goal.summary?.trim())
    throw new CodedBadRequestException(ErrorCode.GOAL_INVALID, 'Informe o objetivo.');
  const distance = goal.targetDistance ? parseTargetDistanceMeters(goal.targetDistance) : null;
  if (goal.targetDistance && (distance == null || !Number.isFinite(distance) || distance <= 0)) {
    throw new CodedBadRequestException(
      ErrorCode.GOAL_INVALID,
      'Informe uma distância maior que zero.',
    );
  }
  const time = goal.targetTime ? parseTargetTimeSeconds(goal.targetTime) : null;
  if (
    goal.targetTime &&
    (time == null ||
      time <= 0 ||
      !Number.isFinite(time) ||
      (/^\d+:/.test(goal.targetTime) &&
        goal.targetTime
          .split(':')
          .slice(1)
          .some((p) => Number(p) >= 60)))
  ) {
    throw new CodedBadRequestException(ErrorCode.GOAL_INVALID, 'Informe um tempo válido.');
  }
  if (goal.eventDate) {
    const date = new Date(goal.eventDate);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(goal.eventDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== goal.eventDate
    ) {
      throw new CodedBadRequestException(ErrorCode.GOAL_INVALID, 'Informe uma data válida.');
    }
  }
  return {
    rawText: goal.rawText?.trim(),
    summary: goal.summary.trim(),
    targetDistance: distance == null ? null : `${distance / 1000}km`,
    targetTime:
      time == null
        ? null
        : `${Math.floor(time / 3600)}:${String(Math.floor(time / 60) % 60).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`,
    eventDate: goal.eventDate || null,
    eventName: goal.eventName?.trim() || null,
  };
}
