import {
  resumePlanningWindow,
  resumeWindowAtExecution,
  ResumeWindowExpiredError,
} from './weekly-calendar';
import { addCalendarDays, localCalendar, mondayOf } from './weekly-calendar';

describe('weekly calendar', () => {
  it.each([
    ['2026-03-02', '2026-03-09T03:59:59Z', '2026-03-09T04:00:00Z'],
    ['2026-10-26', '2026-11-02T04:59:59Z', '2026-11-02T05:00:00Z'],
  ])('uses local Monday midnight across DST for the week of %s', (start, before, after) => {
    const window = resumePlanningWindow(['sunday'], 'America/New_York', new Date(before))!;
    expect(window.weekStartDate).toBe(start);
    expect(resumeWindowAtExecution(window, new Date(before)).availableDays).toEqual(['sunday']);
    expect(() => resumeWindowAtExecution(window, new Date(after))).toThrow(
      ResumeWindowExpiredError,
    );
    expect(
      resumePlanningWindow(['monday'], 'America/New_York', new Date(after))?.weekStartDate,
    ).toBe(addCalendarDays(new Date(start), 7).toISOString().slice(0, 10));
  });
  it('keeps date labels stable across Sunday, Monday, and year boundaries', () => {
    expect(mondayOf(new Date('2027-01-03')).toISOString()).toBe('2026-12-28T00:00:00.000Z');
    expect(addCalendarDays(new Date('2026-12-28'), 7).toISOString()).toBe(
      '2027-01-04T00:00:00.000Z',
    );
    expect(localCalendar(new Date('2026-09-13T14:00:00Z'), 'Asia/Tokyo').hour).toBe(23);
  });
});

describe('resume planning window', () => {
  it('keeps only remaining training days in the local week', () => {
    const window = resumePlanningWindow(
      ['monday', 'wednesday', 'friday'],
      'America/Sao_Paulo',
      new Date('2026-09-16T15:00:00Z'),
    );
    expect(window).toMatchObject({
      weekStartDate: '2026-09-14',
      minTrainingDate: '2026-09-16',
      availableDays: ['wednesday', 'friday'],
    });
  });
  it('returns no window when no available day remains, without anticipating next week', () => {
    expect(resumePlanningWindow(['monday'], 'UTC', new Date('2026-09-16'))).toBeNull();
    expect(
      resumePlanningWindow(['monday'], 'America/Sao_Paulo', new Date('2026-09-21T02:00:00Z')),
    ).toBeNull();
  });
  it('keeps Sunday eligible after 23:00 and expires the reserved week only at local Monday', () => {
    const window = resumePlanningWindow(
      ['sunday'],
      'America/Sao_Paulo',
      new Date('2026-09-21T02:00:00Z'),
    )!;
    expect(window).toMatchObject({
      weekStartDate: '2026-09-14',
      minTrainingDate: '2026-09-20',
      availableDays: ['sunday'],
    });
    expect(resumeWindowAtExecution(window, new Date('2026-09-21T02:59:59Z')).availableDays).toEqual(
      ['sunday'],
    );
    expect(() => resumeWindowAtExecution(window, new Date('2026-09-21T03:00:00Z'))).toThrow(
      ResumeWindowExpiredError,
    );
    expect(
      resumePlanningWindow(['monday'], 'America/Sao_Paulo', new Date('2026-09-21T03:00:00Z')),
    ).toMatchObject({
      weekStartDate: '2026-09-21',
      minTrainingDate: '2026-09-21',
      availableDays: ['monday'],
    });
  });
  it('expires when the last available day passed even before the week ends', () => {
    const window = resumePlanningWindow(['monday'], 'UTC', new Date('2026-09-14'))!;
    expect(() => resumeWindowAtExecution(window, new Date('2026-09-15'))).toThrow(
      ResumeWindowExpiredError,
    );
  });
  it('preserves a next-week window already queued before deployment', () => {
    expect(
      resumeWindowAtExecution(
        {
          weekStartDate: '2026-09-21',
          minTrainingDate: '2026-09-21',
          availableDays: ['monday'],
          timeZone: 'UTC',
        },
        new Date('2026-09-20T23:30:00Z'),
      ),
    ).toMatchObject({
      minTrainingDate: '2026-09-21',
      availableDays: ['monday'],
    });
  });
  it('uses the local date around midnight and advances the execution floor without changing the target week', () => {
    const window = resumePlanningWindow(
      ['tuesday', 'wednesday', 'friday'],
      'America/Sao_Paulo',
      new Date('2026-09-16T01:00:00Z'),
    )!;
    expect(window.minTrainingDate).toBe('2026-09-15');
    expect(resumeWindowAtExecution(window, new Date('2026-09-16T10:00:00Z'))).toMatchObject({
      availableDays: ['wednesday', 'friday'],
      minTrainingDate: '2026-09-16',
    });
    expect(() => resumeWindowAtExecution(window, new Date('2026-09-21T10:00:00Z'))).toThrow(
      ResumeWindowExpiredError,
    );
  });
});
