import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { validationExceptionFactory } from '../../../common/errors/validation-exception.factory';
import { GoalDraftDto } from '../../goals/dto/goal-draft.dto';
import { GoalAnalysisDto } from './goal-analysis.dto';

const validate = (metatype: Type<unknown>, payload: object) =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationExceptionFactory,
  }).transform(payload, { type: 'body', metatype });

const draft = {
  objectiveDistance: '15k',
  objectiveType: 'target_time',
  targetTime: '1:17:30',
  eventDate: '2026-12-27',
};

describe('GoalDraftDto', () => {
  it('aceita as respostas de meta do onboarding, incluindo 15 km', async () => {
    await expect(validate(GoalDraftDto, draft)).resolves.toEqual(draft);
    await expect(
      validate(GoalDraftDto, { objectiveDistance: 'half', objectiveType: 'workload' }),
    ).resolves.toBeDefined();
  });

  it.each([
    ['distância fora da lista', { ...draft, objectiveDistance: '12k' }],
    ['tipo desconhecido', { ...draft, objectiveType: 'pace' }],
    ['tempo mal formatado', { ...draft, targetTime: '1h17' }],
    ['data mal formatada', { ...draft, eventDate: '27/12/2026' }],
    ['campo extra', { ...draft, objective: 'personal' }],
  ])('recusa %s', async (_label, payload) => {
    await expect(validate(GoalDraftDto, payload)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GoalAnalysisDto', () => {
  it('aceita o Health do plano com a meta em rascunho e o fuso', async () => {
    const validated = await validate(GoalAnalysisDto, {
      runs: [],
      runsReadFrom: '2026-08-18T10:00:00.000Z',
      timeZone: 'America/Sao_Paulo',
      goal: draft,
    });
    expect(validated.goal).toBeInstanceOf(GoalDraftDto);
    expect(validated.timeZone).toBe('America/Sao_Paulo');
  });

  it('valida a meta aninhada', async () => {
    await expect(
      validate(GoalAnalysisDto, { runs: [], goal: { ...draft, objectiveDistance: 'marathon' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
