import { useState, useEffect } from "react";
import { Section } from "@/components/layout";
import { GradientText } from "@/components/ui/GradientText";
import { Button } from "@/components/ui/Button";
import { TrainingPlanCalendar } from "@/components/Calendar/TrainingPlanCalendar";
import { getCalendarData } from "@/services/workoutService";
import type { WeeklyGoal, Workout } from "@/types";

export function TrainingPlanCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCalendarData()
      .then((data) => {
        if (data) {
          setWeeklyGoals(data.weeklyGoals);
          setWorkouts(data.workouts);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const goPrev = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  };

  const goNext = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  };

  const goToday = () => {
    setCurrentMonth(new Date());
  };

  const monthYearLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8">
      <Section spacing="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <GradientText variant="primary">
              <h1 className="text-3xl md:text-4xl font-bold">Calendário</h1>
            </GradientText>
            <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
              Plano de treino em vista de mês
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goPrev} className="shrink-0">
              &larr; Anterior
            </Button>
            <Button variant="primary" size="sm" onClick={goToday} className="shrink-0">
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} className="shrink-0">
              Próximo &rarr;
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xl font-semibold capitalize text-[var(--color-text-primary)]">
          {monthYearLabel}
        </p>
      </Section>

      {isLoading ? (
        <div className="py-16 text-center text-[var(--color-text-tertiary)]">
          Carregando calendário...
        </div>
      ) : (
        <TrainingPlanCalendar
          currentMonth={currentMonth}
          weeklyGoals={weeklyGoals}
          workouts={workouts}
        />
      )}
    </div>
  );
}
