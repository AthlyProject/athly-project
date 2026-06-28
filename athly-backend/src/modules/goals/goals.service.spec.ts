import { UnprocessableEntityException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import type { ParsedGoal } from '../ai-planner/prompts/goal-parser-prompt';

// O foco aqui é o gating da criação de meta para um usuário SEM treinos no Apple
// Health (cold start): metas de corrida NUNCA são bloqueadas — a viabilidade é só
// um dado consultivo. O único bloqueio é objetivo fora de corrida.
function makeService(parsedGoal: ParsedGoal, effortZone: { vdotScore: number | null } | null) {
  const gemini = { parseGoal: jest.fn().mockResolvedValue(parsedGoal) };
  const prisma = {
    userGoal: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({
          id: 'goal-1',
          rawText: data.rawText,
          parsedGoal: data.parsedGoal,
          feasibility: data.feasibility ?? null,
          active: true,
          createdAt: new Date('2026-06-24T00:00:00Z'),
        }),
      ),
    },
    userEffortZone: { findFirst: jest.fn().mockResolvedValue(effortZone) },
  };
  const service = new GoalsService(prisma as any, gemini as any);
  return { service, prisma, gemini };
}

const datedGoalNoTime: ParsedGoal = {
  isRunningRelated: true,
  targetDistance: '10k',
  targetTime: null,
  eventDate: '2026-08-20',
  eventName: null,
  experienceLevel: null,
  summary: 'Correr 10km',
  rejectionReason: null,
};

describe('GoalsService.createGoal — cold start (sem treinos no Apple Health)', () => {
  it('cria meta datada SEM tempo-alvo sem bloquear, com feasibility nula', async () => {
    const { service, prisma } = makeService(datedGoalNoTime, null);

    const result = await service.createGoal('user-1', { goalText: 'Correr 10km no dia 20 de agosto' } as any);

    expect(result.id).toBe('goal-1');
    // Sem targetTime não há o que avaliar → feasibility não é persistida.
    const created = prisma.userGoal.create.mock.calls[0][0].data;
    expect(created.feasibility).toBeUndefined();
  });

  it('meta datada COM tempo-alvo no cold start gera veredito lowConfidence, sem bloquear', async () => {
    const { service, prisma } = makeService(
      { ...datedGoalNoTime, targetTime: '00:50:00', experienceLevel: 'beginner', summary: 'Correr 10km em menos de 50min' },
      null, // sem UserEffortZone → DEFAULT_VDOT
    );

    const result = await service.createGoal('user-1', { goalText: '10km sub-50 em 20 de agosto' } as any);

    expect(result.id).toBe('goal-1');
    const created = prisma.userGoal.create.mock.calls[0][0].data;
    expect(created.feasibility).toBeDefined();
    expect(created.feasibility.lowConfidence).toBe(true);
    expect(['ready', 'feasible', 'ambitious', 'unrealistic']).toContain(created.feasibility.verdict);
  });

  it('usa a UserEffortZone quando existe (lowConfidence=false)', async () => {
    const { service, prisma } = makeService(
      { ...datedGoalNoTime, targetTime: '00:50:00', experienceLevel: 'intermediate' },
      { vdotScore: 48 },
    );

    await service.createGoal('user-1', { goalText: '10km sub-50 em 20 de agosto' } as any);

    const created = prisma.userGoal.create.mock.calls[0][0].data;
    expect(created.feasibility.lowConfidence).toBe(false);
    expect(created.feasibility.currentVdot).toBe(48);
  });

  it('bloqueia APENAS objetivo fora de corrida', async () => {
    const { service, prisma } = makeService(
      {
        isRunningRelated: false,
        targetDistance: null,
        targetTime: null,
        eventDate: null,
        eventName: null,
        experienceLevel: null,
        summary: 'Nadar 2km',
        rejectionReason: 'O Athly é focado em corrida.',
      },
      null,
    );

    await expect(
      service.createGoal('user-1', { goalText: 'Quero nadar 2km' } as any),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.userGoal.create).not.toHaveBeenCalled();
  });
});
