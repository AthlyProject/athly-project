import {
  addDays,
  civil,
  daysBetween,
  integer,
  isoWeekday,
  localDate,
  monday,
  requireInput,
  uniqueSorted,
} from './core';
import type { Instant, LocalDate } from './core';
import type { ExerciseStrategy } from './types';

export type CalendarInput = {
  weekStart: LocalDate;
  asOf: Instant;
  timeZone: string;
  availableDays: number[] | null;
  unavailableDates: LocalDate[];
  /** All relevant already-delivered dates, including both adjacent weeks. */
  deliveredDates: LocalDate[];
};

export function preliminaryDates(input: CalendarInput, includePast = false): LocalDate[] | null {
  requireInput(monday(input.weekStart) === input.weekStart);
  input.unavailableDates.forEach(civil);
  input.deliveredDates.forEach(civil);
  if (input.availableDays === null) return null;
  input.availableDays.forEach((d) => integer(d, 1, 7));
  requireInput(new Set(input.availableDays).size === input.availableDays.length);
  const today = localDate(input.asOf, input.timeZone);
  return Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i)).filter(
    (d) =>
      (includePast || d >= today) &&
      input.availableDays!.includes(isoWeekday(d)) &&
      !input.unavailableDates.includes(d) &&
      !input.deliveredDates.includes(d),
  );
}

function fits(strategy: ExerciseStrategy, dates: LocalDate[], boundaries: LocalDate[]): boolean {
  const combined = uniqueSorted([...dates, ...boundaries]);
  if (strategy === 'entry')
    return dates.every((date) =>
      combined.every((other) => date === other || Math.abs(daysBetween(date, other)) >= 2),
    );
  if (strategy === 'duration_rpe')
    for (const date of dates) {
      for (let offset = -2; offset <= 0; offset++) {
        const start = addDays(date, offset);
        if ([0, 1, 2].every((i) => combined.includes(addDays(start, i)))) return false;
      }
    }
  return true;
}

/** Exhaustive over at most 128 subsets; largest feasible set, then earliest chronology. */
export function prescriptionDates(
  input: CalendarInput,
  strategy: ExerciseStrategy,
  maxSessions: number,
  includePast = false,
): LocalDate[] | null {
  integer(maxSessions, 0, 7);
  const candidates = preliminaryDates(input, includePast);
  if (candidates === null) return null;
  let best: LocalDate[] = [];
  for (let mask = 0; mask < 2 ** candidates.length; mask++) {
    const selected = candidates.filter((_, i) => mask & (1 << i));
    if (selected.length > maxSessions || !fits(strategy, selected, input.deliveredDates)) continue;
    if (
      selected.length > best.length ||
      (selected.length === best.length && selected.join(',') < best.join(','))
    )
      best = selected;
  }
  return best;
}
