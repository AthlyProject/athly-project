import { Fragment } from 'react';
import { GradientText } from '@/components/ui/GradientText';
import { Card } from '@/components/ui/Card';
import { AnimatedSection } from './AnimatedSection';
import { Smartphone, Target, Sparkles, RefreshCw, ArrowRight, ArrowDown } from 'lucide-react';

const steps = [
  {
    icon: Smartphone,
    title: 'Conecte seus dados',
    description: 'Importe seus treinos do Apple Health (iOS) ou Health Connect (Android). Distância, pace, FC, elevação, splits — tudo analisado.',
    accent: 'primary' as const,
  },
  {
    icon: Target,
    title: 'Zonas calibradas VDOT',
    description: 'A partir do seu melhor desempenho, calculamos 5 zonas científicas de esforço usando a metodologia Jack Daniels.',
    accent: 'secondary' as const,
  },
  {
    icon: Sparkles,
    title: 'IA cria seu plano',
    description: 'O Gemini gera blocos estruturados (aquecimento, principal, volta à calma) com justificativa para cada treino.',
    accent: 'primary' as const,
  },
  {
    icon: RefreshCw,
    title: 'Adapta toda semana',
    description: 'Seu feedback (esforço, fadiga, treinos pulados) molda o próximo ciclo. A IA evolui com você.',
    accent: 'secondary' as const,
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative py-20 lg:py-28">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-[var(--color-secondary)] opacity-[0.03] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
            <GradientText variant="neon">Como funciona</GradientText>
          </h2>
        </AnimatedSection>

        <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-stretch lg:justify-center lg:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isBlue = step.accent === 'primary';
            return (
              <Fragment key={step.title}>
                <AnimatedSection delay={i * 140} className="w-full max-w-sm lg:max-w-[16rem]">
                  <Card
                    variant="glow"
                    padding="md"
                    className={`h-full min-h-[260px] text-center ${isBlue ? 'glow-primary' : 'glow-secondary'}`}
                  >
                    <div className="flex h-full flex-col items-center justify-start gap-5">
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                          isBlue
                            ? 'bg-[var(--color-primary-neon)]/10 text-[var(--color-primary-neon)]'
                            : 'bg-[var(--color-secondary-neon)]/10 text-[var(--color-secondary-neon)]'
                        }`}
                      >
                        <Icon className="h-8 w-8" />
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                          {step.title}
                        </h3>
                        <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </AnimatedSection>

                {i < steps.length - 1 && (
                  <AnimatedSection
                    delay={i * 140 + 70}
                    className="flex items-center justify-center py-1 lg:py-0"
                  >
                    <div className="glass-flat flex h-11 w-11 items-center justify-center rounded-full border border-white/8">
                      <ArrowDown className="h-5 w-5 text-[var(--color-text-tertiary)] lg:hidden" />
                      <ArrowRight className="hidden h-5 w-5 text-[var(--color-text-tertiary)] lg:block" />
                    </div>
                  </AnimatedSection>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
