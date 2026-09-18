import {
  resumePlanningWindow,
  resumeWindowAtExecution,
  ResumeWindowExpiredError,
} from './weekly-calendar';
import { addCalendarDays, localCalendar, mondayOf, sundayCutoffPassed } from './weekly-calendar';

describe('weekly calendar', () => {
  const week = new Date('2026-09-07T00:00:00Z');
  it('waits until Sunday 23:00 in the user timezone, then catches up after restart', () => {
    expect(sundayCutoffPassed(week, new Date('2026-09-14T01:59:59Z'), 'America/Sao_Paulo')).toBe(
      false,
    );
    expect(sundayCutoffPassed(week, new Date('2026-09-14T02:00:00Z'), 'America/Sao_Paulo')).toBe(
      true,
    );
    expect(sundayCutoffPassed(week, new Date('2026-09-14T08:00:00Z'), 'America/Sao_Paulo')).toBe(
      true,
    );
  });
  it.each([
    ['2026-03-02', '2026-03-09T02:59:59Z', '2026-03-09T03:00:00Z'],
    ['2026-10-26', '2026-11-02T03:59:59Z', '2026-11-02T04:00:00Z'],
  ])('uses DST rules for the week of %s', (start, before, after) => {
    expect(sundayCutoffPassed(new Date(start), new Date(before), 'America/New_York')).toBe(false);
    expect(sundayCutoffPassed(new Date(start), new Date(after), 'America/New_York')).toBe(true);
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
  it('moves to next Monday if no available day remains, or Sunday cutoff passed', () => {
    expect(resumePlanningWindow(['monday'], 'UTC', new Date('2026-09-16')).weekStartDate).toBe(
      '2026-09-21',
    );
    expect(
      resumePlanningWindow(['sunday'], 'America/Sao_Paulo', new Date('2026-09-21T02:00:00Z'))
        .weekStartDate,
    ).toBe('2026-09-21');
  });
  it('uses the local date around midnight and advances the execution floor without changing the target week', () => {
    const window = resumePlanningWindow(
      ['tuesday', 'wednesday', 'friday'],
      'America/Sao_Paulo',
      new Date('2026-09-16T01:00:00Z'),
    );
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
