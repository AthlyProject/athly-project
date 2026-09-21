/** Training dates are calendar labels, stored at UTC midnight; not instants in the user's zone. */
export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function mondayOf(date: Date): Date {
  return addCalendarDays(date, -((date.getUTCDay() + 6) % 7));
}

export function localCalendar(now: Date, timeZone: string): { date: Date; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    date: new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`),
    hour: Number(get('hour')),
  };
}

export const DEFAULT_AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Internal queue metadata, never accepted as a client-selected planning window. */
export type ResumePlanningWindow = {
  weekStartDate: string;
  minTrainingDate: string;
  availableDays: string[];
  timeZone: string;
};

export class ResumeWindowExpiredError extends Error {
  constructor() {
    super('O período desta geração terminou. Toque em tentar novamente para atualizar os dias.');
  }
}

export function resumePlanningWindow(
  days: string[],
  timeZone: string,
  now = new Date(),
): ResumePlanningWindow | null {
  const local = localCalendar(now, timeZone);
  const monday = mondayOf(local.date);
  const normalized = [
    ...new Set(days.map((day) => day.toLowerCase()).filter((day) => DAY_KEYS.includes(day))),
  ];
  const available = normalized.length ? normalized : DEFAULT_AVAILABLE_DAYS;
  const remaining = available.filter((day) => {
    const date = addCalendarDays(monday, (DAY_KEYS.indexOf(day) + 6) % 7);
    return date >= local.date;
  });
  // Opening the app only fills the current week; it never anticipates the next one.
  if (!remaining.length) return null;
  return {
    weekStartDate: monday.toISOString().slice(0, 10),
    minTrainingDate: local.date.toISOString().slice(0, 10),
    availableDays: remaining,
    timeZone,
  };
}

export function resumeWindowAtExecution(window: ResumePlanningWindow, now = new Date()) {
  const monday = new Date(window.weekStartDate);
  const today = localCalendar(now, window.timeZone).date.toISOString().slice(0, 10);
  const minTrainingDate = today > window.minTrainingDate ? today : window.minTrainingDate;
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    addCalendarDays(monday, i).toISOString().slice(0, 10),
  );
  const availableDays = window.availableDays.filter(
    (day) => weekDates[(DAY_KEYS.indexOf(day) + 6) % 7] >= minTrainingDate,
  );
  // After local midnight on Monday, every date in the reserved week is in the past.
  if (!availableDays.length) throw new ResumeWindowExpiredError();
  return {
    weekDates,
    weekStartDate: monday,
    weekEndDate: addCalendarDays(monday, 6),
    minTrainingDate,
    availableDays,
    trainingDays: availableDays.length,
  };
}
