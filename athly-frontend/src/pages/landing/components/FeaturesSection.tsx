import { GradientText } from '@/components/ui/GradientText';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from './AnimatedSection';
import { Gauge, Heart, Brain, RotateCcw } from 'lucide-react';

const features = [
  {
    icon: Gauge,
    badge: 'Ciência',
    badgeVariant: 'secondary' as const,
    title: 'Zonas VDOT Personalizadas',
    description: '5 zonas de pace e frequência cardíaca calculadas a partir da sua corrida mais rápida. Não é chute — é Jack Daniels.',
    glow: 'glow-secondary',
  },
  {
    icon: Heart,
    badge: 'Apple Health + Health Connect',
    badgeVariant: 'primary' as const,
    title: 'Dados Reais do Seu Corpo',
    description: 'Distância, pace médio, FC, elevação, calorias, splits por km. 20 treinos recentes lidos e estruturados.',
    glow: 'glow-primary',
  },
  {
    icon: Brain,
    badge: 'Gemini AI',
    badgeVariant: 'secondary' as const,
    title: 'IA que Explica',
    description: 'Cada treino tem um registro de raciocínio: quais dados foram usados, por que essa intensidade, o que a IA considerou.',
    glow: 'glow-secondary',
  },
  {
    icon: RotateCcw,
    badge: 'Feedback Loop',
    badgeVariant: 'primary' as const,
    title: 'Adaptação Contínua',
    description: 'Taxa de conclusão, nota de esforço e fadiga, mudanças de volume — tudo entra no prompt da próxima semana.',
    glow: 'glow-primary',
  },
];

export function FeaturesSection() {
  return (
    <section className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
            O que só a{' '}
            <GradientText variant="neon">Athly</GradientText>{' '}
            faz
          </h2>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <AnimatedSection key={i} delay={i * 120}>
                <Card variant="glow" padding="lg" className={`h-full ${feature.glow}`}>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-2xl bg-white/[0.04] p-3">
                      <Icon className="h-6 w-6 text-[var(--color-primary-neon)]" />
                    </div>
                    <div className="space-y-3">
                      <Badge variant={feature.badgeVariant} size="sm">
                        {feature.badge}
                      </Badge>
                      <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
