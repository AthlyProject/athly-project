import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { Card, GradientText, Badge, Divider } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/layout'
import { submitWorkoutFeedback } from '@/services/workoutService'
import toast from 'react-hot-toast'

export function FeedbackPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPartial = searchParams.get('partial') === 'true'

  const [completed, setCompleted] = useState(!isPartial)
  const [effort, setEffort] = useState(5)
  const [fatigue, setFatigue] = useState(5)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setLoading(true)
    try {
      await submitWorkoutFeedback(id, {
        completed,
        effort,
        fatigue,
      })
      toast.success('Feedback enviado!')
      navigate('/app/dashboard')
    } catch {
      toast.error('Erro ao enviar feedback')
    } finally {
      setLoading(false)
    }
  }

  const getEffortEmoji = (value: number) => {
    if (value <= 3) return '😌'
    if (value <= 6) return '💪'
    if (value <= 8) return '🔥'
    return '😤'
  }

  const getFatigueEmoji = (value: number) => {
    if (value <= 3) return '⚡'
    if (value <= 6) return '😅'
    if (value <= 8) return '😰'
    return '😵'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section spacing="md">
        <div className="text-center">
          <span className="text-6xl mb-4 block animate-pulse-glow">
            {completed ? '🎉' : '💪'}
          </span>
          <GradientText variant="neon" animated>
            <h1 className="text-3xl md:text-4xl font-bold">
              {completed ? 'Parabéns!' : 'Bom trabalho!'}
            </h1>
          </GradientText>
          <p className="mt-3 text-lg text-[var(--color-text-secondary)]">
            Conte-nos como foi seu treino
          </p>
          <Badge variant={completed ? 'success' : 'warning'} size="lg" className="mt-4">
            {completed ? '✓ Treino completo' : '⚡ Treino parcial'}
          </Badge>
        </div>
      </Section>

      <Divider variant="gradient" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Completion Status */}
        <Section title="Status do Treino" spacing="md">
          <Card variant="glow" padding="lg">
            <h3 className="mb-4 font-semibold text-[var(--color-text-primary)]">
              Conseguiu completar?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCompleted(true)}
                className={`group relative overflow-hidden rounded-xl p-6 transition-all ${
                  completed
                    ? 'gradient-primary text-white glow-primary scale-105'
                    : 'bg-[var(--color-surface-dark)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">✓</span>
                  <span className="font-bold">Sim</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCompleted(false)}
                className={`group relative overflow-hidden rounded-xl p-6 transition-all ${
                  !completed
                    ? 'gradient-primary text-white glow-primary scale-105'
                    : 'bg-[var(--color-surface-dark)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">✗</span>
                  <span className="font-bold">Não</span>
                </div>
              </button>
            </div>
          </Card>
        </Section>

        {/* Effort Level */}
        <Section title="Nível de Esforço" spacing="md">
          <Card padding="lg">
            <div className="text-center mb-6">
              <span className="text-6xl mb-3 block">
                {getEffortEmoji(effort)}
              </span>
              <p className="text-4xl font-bold text-gradient">
                {effort}/10
              </p>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                1 = Muito fácil • 10 = Máximo esforço
              </p>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer slider-gradient"
              style={{
                background: `linear-gradient(to right, var(--color-primary-500) 0%, var(--color-secondary-500) ${(effort / 10) * 100}%, var(--color-surface-dark) ${(effort / 10) * 100}%, var(--color-surface-dark) 100%)`,
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-[var(--color-text-tertiary)]">
              <span>Fácil</span>
              <span>Moderado</span>
              <span>Intenso</span>
            </div>
          </Card>
        </Section>

        {/* Fatigue Level */}
        <Section title="Nível de Fadiga" spacing="md">
          <Card padding="lg">
            <div className="text-center mb-6">
              <span className="text-6xl mb-3 block">
                {getFatigueEmoji(fatigue)}
              </span>
              <p className="text-4xl font-bold text-gradient">
                {fatigue}/10
              </p>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                1 = Energizado • 10 = Exausto
              </p>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={fatigue}
              onChange={(e) => setFatigue(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-success) 0%, var(--color-warning) 50%, var(--color-error) ${(fatigue / 10) * 100}%, var(--color-surface-dark) ${(fatigue / 10) * 100}%, var(--color-surface-dark) 100%)`,
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-[var(--color-text-tertiary)]">
              <span>Energizado</span>
              <span>Normal</span>
              <span>Exausto</span>
            </div>
          </Card>
        </Section>

        <Divider variant="gradient" />

        {/* Submit */}
        <div className="space-y-4">
          <Button
            type="submit"
            variant="gradient"
            fullWidth
            size="lg"
            loading={loading}
            glow
          >
            <BarChart3 className="h-5 w-5 inline mr-2" />Enviar feedback
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => navigate('/app/dashboard')}
          >
            Pular por agora
          </Button>
        </div>
      </form>
    </div>
  )
}
