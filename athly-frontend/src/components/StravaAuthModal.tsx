import { useState } from 'react'
import { Card, Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { initiateStravaOAuth } from '@/services/integrationService'
import toast from 'react-hot-toast'

interface StravaAuthModalProps {
  onContinueWithoutStrava: () => void
  onClose: () => void
}

export function StravaAuthModal({ onContinueWithoutStrava, onClose }: StravaAuthModalProps) {
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    try {
      setConnecting(true)
      await initiateStravaOAuth()
    } catch {
      toast.error('Erro ao conectar com o Strava')
      setConnecting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card variant="default" padding="lg" className="w-full max-w-md animate-in fade-in-0 zoom-in-95">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-5xl">🏃</div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Conecte seu Strava
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Para gerar um plano personalizado, precisamos acessar seu histórico de treinos.
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            {[
              'Analisa seu ritmo e distâncias reais',
              'Adapta a intensidade ao seu nível atual',
              'Cria progressão baseada em dados',
              'Gera planos cada vez mais precisos',
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <span className="text-[var(--color-primary-400)] font-bold text-lg">✓</span>
                <span className="text-sm text-[var(--color-text-secondary)]">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--color-surface-card)] pt-4 space-y-2">
            <p className="text-xs text-[var(--color-text-tertiary)] text-center">
              Sem o Strava, geramos um plano de avaliação inicial com 5 treinos para medir seu
              nível antes de personalizar.
            </p>
            <Badge variant="secondary" size="sm" className="mx-auto block w-fit">
              Plano de avaliação disponível sem Strava
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              variant="gradient"
              glow
              size="lg"
              loading={connecting}
              onClick={handleConnect}
              className="w-full"
            >
              🔗 Conectar Strava
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={onContinueWithoutStrava}
              className="w-full"
            >
              Gerar plano de avaliação sem Strava
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
