import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { SportBadge } from '@/components/SportBadge'
import { Badge } from '@/components/ui/Badge'
import type { Workout } from '@/types'

interface WorkoutCardProps {
  workout: Workout
  compact?: boolean
}

export function WorkoutCard({ workout, compact }: WorkoutCardProps) {
  const date = new Date(workout.date).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  const getStatusBadge = () => {
    switch (workout.status) {
      case 'done':
        return <Badge variant="success" size="sm">✓ Concluído</Badge>
      case 'scheduled':
        return <Badge variant="primary" size="sm">Em andamento</Badge>
      case 'partial':
        return <Badge variant="warning" size="sm">Parcial</Badge>
      case 'skipped':
        return <Badge variant="error" size="sm">Pulado</Badge>
      default:
        return null
    }
  }

  const getOriginBadge = () => {
    if (workout.stravaActivityId) {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: '#FC4C02', color: '#fff' }}
        >
          🏃 Strava
        </span>
      )
    }
    if (workout.status === 'scheduled' || workout.weeklyGoalId) {
      return (
        <Badge variant="primary" size="sm">
          ✨ IA
        </Badge>
      )
    }
    return null
  }

  return (
    <Link to={`/workout/${workout.id}`} className="block">
      <Card className="group hover:border-[var(--color-primary-500)] hover:shadow-[var(--shadow-neon)] transition-all duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SportBadge type={workout.sportType} />
              {getStatusBadge()}
              {getOriginBadge()}
            </div>
            <h3 className="mt-3 font-bold text-[var(--color-text-primary)] text-lg group-hover:text-gradient transition-all">
              {workout.title}
            </h3>
            {!compact && workout.description && (
              <p className="mt-2 line-clamp-2 text-sm text-[var(--color-text-tertiary)]">
                {workout.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
              <span className="flex items-center gap-1">
                📅 {date}
              </span>
              {workout.intensity && (
                <span className="flex items-center gap-1">
                  ⚡ Intensidade {workout.intensity}/10
                </span>
              )}
              {workout.blocks?.length > 0 && (
                <span className="flex items-center gap-1">
                  🎯 {workout.blocks.length} blocos
                </span>
              )}
            </div>
          </div>
          <span className="text-[var(--color-primary-400)] text-xl group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </Card>
    </Link>
  )
}
