import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Inbox, Rocket, Check, Zap, Activity, Sparkles } from 'lucide-react'
import { Card, GradientText, StatCard, Badge, Divider } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { WorkoutCard } from '@/components/WorkoutCard'
import { SkeletonWorkout } from '@/components/ui/Skeleton'
import { Section } from '@/components/layout'
import { getWorkoutHistory } from '@/services/historyService'
import type { Workout } from '@/types'

export function HistoryPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWorkoutHistory()
      .then(setWorkouts)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonWorkout />
        <SkeletonWorkout />
      </div>
    )
  }

  const completedWorkouts = workouts.filter((w) => w.status === 'done')
  const partialWorkouts = workouts.filter((w) => w.status === 'partial')
  const totalDistance = workouts.reduce((sum, w) => {
    return sum + (w.blocks?.reduce((bs, b) => bs + (b.distance || 0), 0) || 0)
  }, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section spacing="md">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <GradientText variant="primary">
              <h1 className="text-3xl md:text-4xl font-bold">Histórico</h1>
            </GradientText>
            <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
              Sua jornada de treinos
            </p>
          </div>
          <Badge variant="neon" size="lg">
            <BarChart3 className="h-4 w-4 inline mr-1" />{workouts.length} treinos
          </Badge>
        </div>
      </Section>

      {workouts.length === 0 ? (
        <Card variant="gradient" padding="lg">
          <div className="text-center py-12">
            <Inbox className="h-16 w-16 mx-auto mb-4 text-[var(--color-text-tertiary)]" />
            <h2 className="text-2xl font-bold text-gradient mb-3">
              Nenhum treino realizado
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
              Comece sua jornada agora e acompanhe seu progresso aqui!
            </p>
            <Link to="/app/plan">
              <Button variant="gradient" size="lg" glow>
                <Rocket className="h-5 w-5 inline mr-2" />Ver plano de treinos
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              label="Completos"
              value={completedWorkouts.length}
              icon={<Check className="h-5 w-5" />}
              gradient
              variant="glow"
            />
            <StatCard
              label="Parciais"
              value={partialWorkouts.length}
              icon={<Zap className="h-5 w-5" />}
              badge={partialWorkouts.length > 0 ? { text: 'Continue!', variant: 'warning' } : undefined}
            />
            <StatCard
              label="Distância"
              value={`${totalDistance.toFixed(1)} km`}
              icon={<Activity className="h-5 w-5" />}
              trend={{ value: 12, label: 'vs. mês passado' }}
            />
          </div>

          <Divider variant="gradient" />

          {/* Timeline */}
          <Section
            title="Timeline de Treinos"
            subtitle="Ordenados do mais recente"
            spacing="md"
          >
            <div className="space-y-4">
              {workouts.map((workout, index) => (
                <div key={workout.id} className="relative">
                  {index === 0 && (
                    <Badge variant="success" size="sm" className="absolute -top-2 left-4 z-10">
                      <Sparkles className="h-3 w-3 inline mr-1" />Mais recente
                    </Badge>
                  )}
                  <WorkoutCard workout={workout} compact />
                </div>
              ))}
            </div>
          </Section>

          {/* Summary Card */}
          <Card variant="gradient" padding="lg">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gradient mb-2">
                Continue assim!
              </h3>
              <p className="text-[var(--color-text-secondary)]">
                Você já completou {completedWorkouts.length} treinos. Parabéns pela dedicação!
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
