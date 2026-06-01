import { useEffect, useState } from "react";
import { CalendarDays, Sparkles, Trophy, Dumbbell, Inbox, Star, Check } from "lucide-react";
import { Card, GradientText, Badge, Divider } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { WorkoutCard } from "@/components/WorkoutCard";
import { SkeletonWorkout } from "@/components/ui/Skeleton";
import { Section } from "@/components/layout";
import { useWorkoutStore } from "@/store/workoutStore";
import { getCurrentTrainingPlan, planNextWeek } from "@/services/workoutService";
import toast from "react-hot-toast";

export function PlanPage() {
  const { currentPlan, setCurrentPlan, isLoading, setLoading } = useWorkoutStore();
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCurrentTrainingPlan()
      .then((plan) => {
        setCurrentPlan(plan);
      })
      .finally(() => setLoading(false));
  }, [setCurrentPlan, setLoading]);

  async function handleGeneratePlan() {
    try {
      setGenerating(true);
      await planNextWeek();
      toast.success("Plano gerado com sucesso!");
      const plan = await getCurrentTrainingPlan();
      setCurrentPlan(plan);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar plano");
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonWorkout />
        <SkeletonWorkout />
      </div>
    );
  }

  const weeks = currentPlan?.weeks ?? [];
  const workouts = weeks[selectedWeek]?.workouts ?? [];
  const completedCount = workouts.filter((w) => w.status === "done").length;

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <Section spacing="md">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <GradientText variant="primary">
                <h1 className="text-3xl md:text-4xl font-bold">Plano de Treino</h1>
              </GradientText>
              <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
                Seu calendário personalizado
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="neon" size="lg">
                <CalendarDays className="h-4 w-4 inline mr-1" />{weeks.length} semanas
              </Badge>
              <Button
                variant="gradient"
                glow
                size="md"
                loading={generating}
                onClick={handleGeneratePlan}
              >
                <Sparkles className="h-4 w-4 inline mr-1" />Gerar Próxima Semana
              </Button>
            </div>
          </div>
        </Section>

        {/* Week Selector */}
        {weeks.length > 1 && (
          <Card variant="default" padding="lg">
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
              Selecione a semana
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {weeks.map((week, i) => (
                <button
                  key={week.number}
                  onClick={() => setSelectedWeek(i)}
                  className={`group shrink-0 rounded-xl px-6 py-3 text-sm font-bold transition-all ${
                    selectedWeek === i
                      ? "gradient-primary text-white glow-primary scale-105"
                      : "bg-[var(--color-surface-dark)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] hover:scale-105"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs opacity-70">Semana</span>
                    <span className="text-xl">{week.number}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Week Stats */}
        <Card variant="gradient" padding="lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase mb-1">
                Semana {weeks[selectedWeek]?.number || 1}
              </h3>
              <p className="text-3xl font-bold text-gradient">
                {completedCount} de {workouts.length}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                treinos completados
              </p>
            </div>
            <div className="text-right">
              <div className="mb-2">
                {completedCount === workouts.length && workouts.length > 0
                  ? <Trophy className="h-12 w-12 text-yellow-400" />
                  : <Dumbbell className="h-12 w-12 text-[var(--color-primary-400)]" />}
              </div>
              {completedCount === workouts.length && workouts.length > 0 && (
                <Badge variant="success" size="sm"><Check className="h-3 w-3 inline mr-1" />Semana completa!</Badge>
              )}
            </div>
          </div>
        </Card>

        <Divider variant="gradient" />

        {/* Workouts */}
        <Section
          title={`Treinos da Semana ${weeks[selectedWeek]?.number || 1}`}
          subtitle={`${workouts.length} treinos programados`}
          spacing="md"
        >
          <div className="space-y-4">
            {workouts.length === 0 ? (
              <Card variant="default" padding="lg">
                <div className="text-center py-8 space-y-4">
                  <Inbox className="h-16 w-16 mx-auto text-[var(--color-text-tertiary)]" />
                  <h3 className="text-xl font-bold text-gradient">Nenhum treino programado</h3>
                  <p className="text-[var(--color-text-secondary)]">
                    Clique em "Gerar Próxima Semana" para criar seu plano personalizado
                  </p>
                  <Button variant="gradient" glow onClick={handleGeneratePlan} loading={generating}>
                    <Sparkles className="h-4 w-4 inline mr-1" />Gerar Plano
                  </Button>
                </div>
              </Card>
            ) : (
              workouts.map((workout, index) => (
                <div key={workout.id} className="relative">
                  {index === 0 && workout.status === "scheduled" && (
                    <Badge variant="neon" size="sm" className="absolute -top-2 left-4 z-10">
                      <Star className="h-3 w-3 inline mr-1" />Próximo treino
                    </Badge>
                  )}
                  <WorkoutCard workout={workout} />
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
