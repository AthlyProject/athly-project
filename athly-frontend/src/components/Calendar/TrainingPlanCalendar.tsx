import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { SportBadge } from "@/components/SportBadge";
import type { Workout, WeeklyGoal } from "@/types";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMonthGrid(year: number, month: number): { date: Date; iso: string; isCurrentMonth: boolean }[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const startOffset = startDay;
  const daysInMonth = last.getDate();

  const weeks: { date: Date; iso: string; isCurrentMonth: boolean }[][] = [];
  let week: { date: Date; iso: string; isCurrentMonth: boolean }[] = [];
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const dayIndex = i - startOffset;
    const d = new Date(year, month, 1 + dayIndex);
    const iso = toISO(d);
    const isCurrentMonth = d.getMonth() === month;
    week.push({ date: d, iso, isCurrentMonth });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  return weeks;
}

function getWeekRange(week: { date: Date; iso: string }[]): { start: string; end: string } {
  if (week.length === 0) return { start: "", end: "" };
  const start = week[0].iso;
  const end = week[week.length - 1].iso;
  return { start, end };
}

function getWeeklyGoalForWeek(
  weeklyGoals: WeeklyGoal[],
  weekStart: string,
  weekEnd: string
): WeeklyGoal | undefined {
  return weeklyGoals.find(
    (wg) => toISO(wg.weekStartDate) <= weekEnd && toISO(wg.weekEndDate) >= weekStart
  );
}

interface TrainingPlanCalendarProps {
  currentMonth: Date;
  weeklyGoals: WeeklyGoal[];
  workouts: Workout[];
}

export function TrainingPlanCalendar({
  currentMonth,
  weeklyGoals,
  workouts,
}: TrainingPlanCalendarProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const grid = getMonthGrid(year, month);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 rounded-xl border border-[var(--color-border-dark)] bg-[var(--color-surface-card)] overflow-hidden">
        {/* Day headers */}
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-r border-[var(--color-border-dark)] bg-[var(--color-surface-dark)] px-2 py-3 text-center text-xs font-semibold uppercase text-[var(--color-text-tertiary)] last:border-r-0"
          >
            {label}
          </div>
        ))}

        {/* Week rows: for each week, one full-width goal row + one row of 7 day cells */}
        {grid.map((week, weekIndex) => {
          const { start: weekStart, end: weekEnd } = getWeekRange(week);
          const weekGoal = getWeeklyGoalForWeek(weeklyGoals, weekStart, weekEnd);
          const goalTitle =
            ((weekGoal?.metrics as Record<string, unknown>)?.title as string) ||
            (weekGoal ? `Semana ${weekIndex + 1}` : null);

          return (
            <div key={weekIndex} className="contents">
              {/* Weekly goal bar - full width row */}
              <div className="col-span-7 border-b border-[var(--color-border-dark)] bg-[var(--color-surface-dark)] px-3 py-2">
                {goalTitle ? (
                  <span className="rounded-lg border border-[var(--color-primary-500)] bg-gradient-to-r from-[var(--color-primary-500)]/20 to-[var(--color-secondary-500)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                    {goalTitle}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    —
                  </span>
                )}
              </div>
              {/* Day cells for this week */}
              {week.map(({ date, iso, isCurrentMonth }) => {
                const dayWorkouts = workouts.filter((w) => w.date === iso);
                const isToday = toISO(new Date()) === iso;

                return (
                  <div
                    key={iso}
                    className={`min-h-[100px] border-b border-r border-[var(--color-border-dark)] bg-[var(--color-surface-card)] p-2 last:border-r-0 ${
                      !isCurrentMonth ? "opacity-50" : ""
                    } ${isToday ? "ring-1 ring-inset ring-[var(--color-primary-500)]" : ""}`}
                  >
                    <div
                      className={`mb-2 text-sm font-semibold ${
                        isToday
                          ? "flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-500)] text-white"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="space-y-1.5">
                      {dayWorkouts.map((workout) => (
                        <Link
                          key={workout.id}
                          to={`/workout/${workout.id}`}
                          className="block"
                        >
                          <Card
                            variant="flat"
                            padding="sm"
                            className="hover:border-[var(--color-primary-500)] hover:shadow-[var(--shadow-neon)] transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <SportBadge type={workout.sportType} showEmoji={true} />
                              <span className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                                {workout.title}
                              </span>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
