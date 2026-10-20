import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { AssessmentService } from './assessment.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

describe('AssessmentService event date', () => {
  const now = new Date('2026-10-18T21:30:00Z');
  const prisma = {
    planGenerationJob: { findFirst: jest.fn() },
    user: { update: jest.fn() },
    userGoal: { updateMany: jest.fn(), create: jest.fn() },
    weeklyGoal: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: AssessmentService;

  const personal = (overrides: Partial<SubmitAssessmentDto> = {}): SubmitAssessmentDto => ({
    termsAccepted: true,
    objective: 'personal',
    objectiveDistance: 'half',
    objectiveType: 'target_time',
    targetTime: '1:45:00',
    ...overrides,
  });

  const savedGoal = () =>
    (prisma.userGoal.create.mock.calls[0][0] as { data: { parsedGoal: { eventDate: unknown } } })
      .data.parsedGoal;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.resetAllMocks();
    prisma.planGenerationJob.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([{}, {}, { id: 'goal-1' }]);
    service = new AssessmentService(prisma as unknown as PrismaService);
  });
  afterEach(() => jest.useRealTimers());

  it('stores the race date of a personal goal', async () => {
    await service.submit('user-1', personal({ eventDate: '2027-04-18' }));
    expect(savedGoal().eventDate).toBe('2027-04-18');
  });

  it("clears the old goal's future skeleton, keeping delivered weeks and reservations", async () => {
    await service.submit('user-1', personal({ eventDate: '2027-04-18' }));
    expect(prisma.weeklyGoal.deleteMany).toHaveBeenCalledWith({
      where: {
        trainingPlan: { userId: 'user-1' },
        status: 'PLANNED',
        workouts: { none: {} },
        NOT: { metrics: { equals: {} } },
      },
    });
  });

  it('keeps the goal undated when no date is sent', async () => {
    await service.submit('user-1', personal());
    expect(savedGoal().eventDate).toBeNull();
  });

  it('ignores the date on the fitness objective', async () => {
    await service.submit('user-1', {
      termsAccepted: true,
      objective: 'fitness',
      eventDate: '2027-04-18',
    });
    expect(savedGoal().eventDate).toBeNull();
  });

  it('accepts today in UTC, which covers tomorrow in Brazil late at night', async () => {
    await service.submit('user-1', personal({ eventDate: '2026-10-18' }));
    expect(savedGoal().eventDate).toBe('2026-10-18');
  });

  it.each([
    ['in the past', '2026-10-17'],
    ['not a calendar date', '2027-02-30'],
    ['beyond the 3-year horizon', '2029-11-01'],
  ])('rejects a date %s before touching the database', async (_label, eventDate) => {
    const attempt = service.submit('user-1', personal({ eventDate }));
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toMatchObject({
      response: { code: ErrorCode.ASSESSMENT_EVENT_DATE_INVALID },
    });
    expect(prisma.planGenerationJob.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
