import { normalizeGoalDraft } from './dto/goal-draft.dto';
import { AssessmentService } from '../assessment/assessment.service';
import { GeminiService } from '../ai-planner/gemini.service';
import { buildCountdownSection } from '../ai-planner/prompts/planner-prompt';

const base = { summary: 'Correr sem parar' };
describe('reviewed running goals', () => {
  it.each([
    ['4km', '4km'],
    ['7,5km', '7.5km'],
    ['30km', '30km'],
    ['21km', '21km'],
    ['half', '21.0975km'],
    ['42km', '42km'],
    ['marathon', '42.195km'],
  ])('preserves %s as %s', (input, expected) => {
    expect(normalizeGoalDraft({ ...base, targetDistance: input }).targetDistance).toBe(expected);
  });
  it.each(['0km', '-4km', 'outro', 'Infinitykm'])(
    'rejects invalid distance %s',
    (targetDistance) => {
      expect(() => normalizeGoalDraft({ ...base, targetDistance })).toThrow();
    },
  );
  it.each(['2027-02-30', 'março', '2027-13-01'])('rejects invalid date %s', (eventDate) => {
    expect(() => normalizeGoalDraft({ ...base, eventDate })).toThrow();
  });
  it('normalizes time and preserves civil dates', () => {
    expect(
      normalizeGoalDraft({ ...base, targetTime: '47:30', eventDate: '2027-03-14' }),
    ).toMatchObject({ targetTime: '0:47:30', eventDate: '2027-03-14' });
    expect(() => normalizeGoalDraft({ ...base, targetTime: '47:99' })).toThrow();
  });
  it('saves reviewed values atomically, retaining original text', async () => {
    const prisma = {
      planGenerationJob: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { update: jest.fn() },
      userGoal: { updateMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([{}, {}, { id: 'goal' }]),
    };
    await new AssessmentService(prisma as any).submit('user', {
      termsAccepted: true,
      fitnessLevel: 'beginner',
      objectiveDistance: '5k',
      goal: { ...base, rawText: 'quero 4km', targetDistance: '7.5km', eventDate: '2027-05-01' },
    });
    expect(prisma.userGoal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawText: 'quero 4km',
        parsedGoal: expect.objectContaining({
          targetDistance: '7.5km',
          eventDate: '2027-05-01',
          experienceLevel: 'beginner',
        }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('keeps legacy assessment behavior', () => {
    const service = new AssessmentService({} as any);
    expect(
      (service as any).buildParsedGoal({ objective: 'personal', objectiveDistance: '5k' }),
    ).toMatchObject({ targetDistance: '5k', eventDate: null });
  });
  it('interprets without persistence and preserves warnings', async () => {
    const service = new GeminiService({ get: () => undefined } as any);
    const generate = jest.spyOn(service as any, 'generateJson').mockResolvedValue({
      rawResponse: JSON.stringify({
        isRunningRelated: true,
        ...base,
        targetDistance: '30km',
        targetTime: null,
        eventDate: null,
        eventName: null,
        warnings: ['Informe a data completa'],
      }),
      usage: {},
    });
    jest.spyOn(service as any, 'formatUsageLog').mockReturnValue('test');
    const result = await service.interpretGoal('30km em março', 'pt-BR');
    expect(result.goal.targetDistance).toBe('30km');
    expect(result.goal.eventDate).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('surfaces provider failure without creating a goal', async () => {
    const service = new GeminiService({ get: () => undefined } as any);
    jest.spyOn(service as any, 'generateJson').mockRejectedValue(new Error('offline'));
    await expect(service.interpretGoal('correr 4km')).rejects.toThrow();
  });
  it('supports completion-only race countdown', () => {
    const prompt = buildCountdownSection(
      {
        ...base,
        isRunningRelated: true,
        targetDistance: '30km',
        targetTime: null,
        eventDate: '2027-03-14',
        eventName: null,
        experienceLevel: null,
        rejectionReason: null,
      },
      {
        weekIndex: 0,
        weekStartDate: '2027-03-08',
        weekEndDate: '2027-03-14',
        phase: 'race',
        weeksToEvent: 0,
        targetVolumeKm: 35,
        longRunKm: 30,
        intensityFocus: '',
        isRaceWeek: true,
      },
    );
    expect(prompt).toContain('2027-03-14');
    expect(prompt).toContain('sem tempo alvo');
  });
});
