import { useEffect, useState } from 'react'
import { Card, GradientText, Badge, Divider, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/layout'
import {
  getIntegrations,
  connectIntegration,
  disconnectIntegration,
  initiateStravaOAuth,
  syncStrava,
  disconnectStrava,
} from '@/services/integrationService'
import type { Integration } from '@/types'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    getIntegrations().then(setIntegrations).finally(() => setLoading(false))
  }, [])

  const stravaIntegration = integrations.find((i) => i.type === 'strava')
  const stravaConnected = stravaIntegration?.connected === true

  async function handleStravaConnect() {
    try {
      setConnecting(true)
      await initiateStravaOAuth()
    } catch {
      toast.error('Erro ao iniciar conexão com Strava')
      setConnecting(false)
    }
  }

  async function handleStravaDisconnect() {
    try {
      await disconnectStrava()
      setIntegrations((prev) =>
        prev.map((i) => (i.type === 'strava' ? { ...i, connected: false } : i)),
      )
      toast.success('Strava desconectado')
    } catch {
      toast.error('Erro ao desconectar Strava')
    }
  }

  async function handleStravaSync() {
    try {
      setSyncing(true)
      const result = await syncStrava()
      if (result.synced === 0) {
        toast.success('Nenhuma atividade nova para sincronizar')
      } else {
        toast.success(`${result.synced} atividade(s) sincronizada(s)!`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function handleConnect(id: string) {
    try {
      const updated = await connectIntegration(id)
      setIntegrations((prev) => prev.map((i) => (i.id === id ? updated : i)))
      toast.success(`${updated.name} conectado!`)
    } catch {
      toast.error('Erro ao conectar')
    }
  }

  async function handleDisconnect(id: string) {
    try {
      const updated = await disconnectIntegration(id)
      setIntegrations((prev) => prev.map((i) => (i.id === id ? updated : i)))
      toast.success(`${updated.name} desconectado`)
    } catch {
      toast.error('Erro ao desconectar')
    }
  }

  const connectedCount = integrations.filter((i) => i.connected).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section spacing="md">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <GradientText variant="primary">
              <h1 className="text-3xl md:text-4xl font-bold">Configurações</h1>
            </GradientText>
            <p className="mt-2 text-lg text-[var(--color-text-secondary)]">
              Conecte serviços e personalize
            </p>
          </div>
          <Badge variant="neon" size="lg">
            ⚙️ {connectedCount} conectados
          </Badge>
        </div>
      </Section>

      {/* Stats */}
      <Card variant="gradient" padding="lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-tertiary)] uppercase mb-1">
              Integrações Ativas
            </h3>
            <p className="text-4xl font-bold text-gradient">{connectedCount}</p>
          </div>
          <div className="text-5xl">{connectedCount > 0 ? '🔗' : '⚡'}</div>
        </div>
      </Card>

      <Divider variant="gradient" />

      {/* Strava Card — destaque especial */}
      <Section title="Strava" subtitle="Sincronize seus treinos automaticamente" spacing="md">
        <Card
          variant={stravaConnected ? 'glow' : 'default'}
          padding="lg"
          className="border-[#FC4C02]/30"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="text-4xl">🏃</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[var(--color-text-primary)] text-lg">Strava</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {stravaConnected ? (
                    <Badge variant="success" size="sm">✓ Conectado</Badge>
                  ) : (
                    <Badge variant="secondary" size="sm">Desconectado</Badge>
                  )}
                  {stravaConnected && stravaIntegration?.stravaAthleteId && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      ID: {stravaIntegration.stravaAthleteId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {stravaConnected
                    ? 'Atividades sincronizadas automaticamente'
                    : 'Conecte para sincronizar suas corridas e gerar planos personalizados'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {stravaConnected ? (
                <>
                  <Button
                    size="md"
                    variant="outline"
                    loading={syncing}
                    onClick={handleStravaSync}
                  >
                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar'}
                  </Button>
                  <Button size="md" variant="danger" onClick={handleStravaDisconnect}>
                    🔌 Desconectar
                  </Button>
                </>
              ) : (
                <Button
                  size="md"
                  variant="gradient"
                  glow
                  loading={connecting}
                  onClick={handleStravaConnect}
                >
                  🔗 Conectar Strava
                </Button>
              )}
            </div>
          </div>
        </Card>
      </Section>

      <Divider variant="gradient" />

      {/* Outras integrações */}
      <Section
        title="Outras Integrações"
        subtitle="Sincronize seus dados com outros apps e dispositivos"
        spacing="md"
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {integrations
              .filter((i) => i.type !== 'strava')
              .map((integration) => (
                <Card
                  key={integration.id}
                  variant={integration.connected ? 'glow' : 'default'}
                  padding="lg"
                  className="group hover:scale-[1.02] transition-all"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="text-4xl">{integration.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--color-text-primary)] text-lg">
                          {integration.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {integration.connected ? (
                            <Badge variant="success" size="sm">✓ Conectado</Badge>
                          ) : (
                            <Badge variant="secondary" size="sm">Desconectado</Badge>
                          )}
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            {integration.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="md"
                      variant={integration.connected ? 'outline' : 'gradient'}
                      glow={!integration.connected}
                      onClick={() =>
                        integration.connected
                          ? handleDisconnect(integration.id)
                          : handleConnect(integration.id)
                      }
                    >
                      {integration.connected ? '🔌 Desconectar' : '🔗 Conectar'}
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </Section>

      {/* Info Card */}
      <Card variant="default" padding="lg">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💡</span>
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] mb-2">Por que conectar?</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Conecte o Strava para sincronizar automaticamente seus treinos e gerar planos
              semanais personalizados com base no seu histórico real de performance.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
