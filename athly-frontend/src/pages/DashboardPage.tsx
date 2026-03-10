import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, GradientText, StatCard, ProgressBar, Badge, Divider } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { WorkoutCard } from '@/components/WorkoutCard'
import { SkeletonWorkout } from '@/components/ui/Skeleton'
import { Section } from '@/components/layout'
import { StravaAuthModal } from '@/components/StravaAuthModal'
import { useAuthStore } from '@/store/authStore'
import { useWorkoutStore } from '@/store/workoutStore'
import { getTodayWorkout, getCurrentTrainingPlan } from '@/services/workoutService'
import { getIntegrations, isStravaConnected } from '@/services/integrationService'
import type { Workout } from '@/types'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { todayWorkout, currentPlan, setTodayWorkout, setCurrentPlan, setLoading, isLoading } = useWorkoutStore()
  const [nextWorkout, setNextWorkout] = useState<Workout | null>(null)
  const [showStravaModal, setShowStravaModal] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getTodayWorkout(), getCurrentTrainingPlan(), getIntegrations()])
      .then(([today, plan, integrations]) => {
        setTodayWorkout(today)
        setCurrentPlan(plan)
        if (plan?.weeks[0]?.workouts?.[1]) {
          setNextWorkout(plan.weeks[0].workouts[1])
        }
        if (!isStravaConnected(integrations)) {
          setShowStravaModal(true)
        }
      })
      .finally(() => setLoading(false))
  }, [setTodayWorkout, setCurrentPlan, setLoading])

  const completedCount = currentPlan?.weeks?.[0]?.workouts?.filter(
    (w) => w.status === 'completed'
  ).length ?? 0
  const totalCount = currentPlan?.weeks?.[0]?.workouts?.length ?? 5
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <>
      {showStravaModal && (
        <StravaAuthModal
          onContinueWithoutStrava={() => setShowStravaModal(false)}
          onClose={() => setShowStravaModal(false)}
        />
      )}
    <div className="space-y-8">
      {/* Header */}
      <Section spacing="md">
        <div className="flex items-center gap-3">
          <GradientText variant="neon">
            <h1 className="text-3xl md:text-4xl font-bold">
              Olá, {user?.name?.split(' ')[0] ?? 'atleta'}!
            </h1>
          </GradientText>
          <span className="text-2xl animate-pulse-glow">👋</span>
        </div>
        <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
          Pronto para treinar hoje?
        </p>
      </Section>

      {/* Today's Workout */}
      {isLoading ? (
        <SkeletonWorkout />
      ) : todayWorkout ? (
        <Card variant="glow" padding="lg" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 gradient-primary opacity-10 blur-3xl rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="neon" size="lg">✨ Treino de Hoje</Badge>
              <span className="text-4xl">🔥</span>
            </div>
            <WorkoutCard workout={todayWorkout} />
            <Link to={`/workout/${todayWorkout.id}`} className="mt-6 block">
              <Button variant="gradient" fullWidth size="lg" glow>
                🚀 Iniciar treino agora
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card variant="gradient" padding="lg">
          <div className="text-center py-8">
            <span className="text-6xl mb-4 block">😴</span>
            <h2 className="text-2xl font-bold text-gradient mb-2">
              Dia de descanso
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              Aproveite para recuperar as energias!
            </p>
          </div>
        </Card>
      )}

      <Divider variant="gradient" />

      {/* Progress */}
      <Section title="Progresso Semanal" spacing="md">
        <Card padding="lg">
          <ProgressBar 
            value={progress} 
            variant="gradient"
            showValue 
            glow
            size="lg"
          />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-tertiary)]">
              Treinos completados
            </span>
            <span className="text-lg font-bold text-gradient">
              {completedCount} de {totalCount}
            </span>
          </div>
        </Card>
      </Section>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Esta Semana"
          value={completedCount}
          icon="✓"
          variant="default"
          gradient
        />
        <StatCard
          label="Sequência"
          value="7 dias"
          icon="🔥"
          badge={{ text: 'Recorde!', variant: 'success' }}
        />
        <StatCard
          label="Total"
          value={`${totalCount * 4}`}
          icon="🏆"
          trend={{ value: 15, label: 'vs. mês passado' }}
        />
      </div>

      {/* Next Workout */}
      {nextWorkout && (
        <Section 
          title="Próximo Treino" 
          subtitle="Prepare-se para o que vem"
          spacing="md"
        >
          <WorkoutCard workout={nextWorkout} compact />
        </Section>
      )}

      <Divider variant="gradient" spacing="lg" />

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to="/plan" className="flex-1">
          <Button variant="outline" fullWidth size="lg">
            📅 Ver plano completo
          </Button>
        </Link>
        <Link to="/history" className="flex-1">
          <Button variant="ghost" fullWidth size="lg">
            📊 Histórico
          </Button>
        </Link>
      </div>
    </div>
    </>
  )
}
