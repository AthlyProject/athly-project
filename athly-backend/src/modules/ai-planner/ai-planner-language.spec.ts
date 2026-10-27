import { AiPlannerService } from './ai-planner.service';
import { GeminiService } from './gemini.service';
import type { PlanFromHealthDto } from './dto/plan-from-health.dto';

describe.each(['request', 'background'])('planner language from persisted user (%s)', (mode) => {
  describe.each(['planner', 'assessment'])('%s generation', (kind) => {
    it.each([
      ['de-DE', 'German (Deutsch)'],
      ['en', 'English'],
      [null, 'Brazilian Portuguese (pt-BR)'],
      ['fr', 'English'],
    ])(
      'uses stored %p without requiring headers or an extra user query',
      async (language, name) => {
        const prisma = {
          user: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ language, availableDays: ['monday', 'wednesday', 'friday'] }),
          },
          userGoal: { findFirst: jest.fn().mockResolvedValue(null) },
          trainingPlan: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: 'plan', status: 'ACTIVE', startDate: '2026-10-26' }),
          },
          weeklyGoal: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({ id: 'week' }),
            update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'week', ...data })),
          },
          aiPlannerPromptLog: { create: jest.fn().mockResolvedValue({}) },
          planGenerationJob: {
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          pushDevice: { findMany: jest.fn().mockResolvedValue([]) },
          $transaction: jest.fn(),
        };
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        const gemini = new GeminiService({ get: () => 'test-key' } as any);
        // Keep the real service -> Gemini -> prompt chain, substituting only model execution.
        const execute = jest
          .spyOn(gemini as any, 'runWithStructureGate')
          .mockImplementation(async (prompt) => ({
            prompt,
            modelUsed: 'test',
            rawResponse: '{}',
            parsed: { analysis: { title: 'test' }, weekPlan: [] },
          }));
        const planner = new AiPlannerService(
          prisma as any,
          gemini,
          {
            getOrCalculateForUser: jest.fn().mockResolvedValue({ formatted: '', vdotScore: null }),
          } as any,
          { analyzeSessions: jest.fn().mockResolvedValue([]) } as any,
          { getForUser: jest.fn().mockResolvedValue(null) } as any,
          {} as any,
          {
            resolve: jest.fn(async (_userId, input: PlanFromHealthDto) => ({ runs: input.runs })),
          } as any,
        );
        const input: PlanFromHealthDto = {
          weekStartDate: '2026-10-26',
          runs:
            kind === 'assessment'
              ? []
              : [
                  {
                    startDate: '2026-10-23T10:00:00Z',
                    distanceMeters: 5000,
                    durationSeconds: 1800,
                    averagePaceSecondsPerKm: 360,
                  },
                ],
        };

        await planner.planFromHealth(
          'user-1',
          input,
          mode === 'background' ? 'job-1' : undefined,
          mode === 'background' ? 'lease-1' : undefined,
        );

        expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          select: { availableDays: true, fitnessLevel: true, language: true },
        });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][0]).toContain(
          `MANDATORY: write ALL user-visible text in ${name}.`,
        );
        expect(prisma.aiPlannerPromptLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            generationType: kind,
            promptText: execute.mock.calls[0][0],
          }),
        });
        if (mode === 'background') {
          expect(prisma.planGenerationJob.update).toHaveBeenCalledWith({
            where: { id: 'job-1' },
            data: expect.objectContaining({ status: 'COMPLETED' }),
          });
        }
      },
    );
  });
});
