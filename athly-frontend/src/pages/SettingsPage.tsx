import { Settings } from 'lucide-react'
import { Card, GradientText, Badge } from '@/components/ui'
import { Section } from '@/components/layout'

export function SettingsPage() {
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
              Personalize sua experiência
            </p>
          </div>
          <Badge variant="neon" size="lg">
            <Settings className="h-4 w-4 inline mr-1" />Configurações
          </Badge>
        </div>
      </Section>

      <Card variant="default" padding="lg">
        <p className="text-[var(--color-text-secondary)] text-sm">
          Em breve você poderá personalizar suas preferências por aqui.
        </p>
      </Card>
    </div>
  )
}
