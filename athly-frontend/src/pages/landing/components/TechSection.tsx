import { GradientText } from '@/components/ui/GradientText';
import { AnimatedSection } from './AnimatedSection';
import { Smartphone, Database, UserCheck, FileText, Cpu, CalendarDays } from 'lucide-react';

const flowSteps = [
  { icon: Smartphone, label: 'Apple Health\nHealth Connect', color: 'var(--color-primary-neon)' },
  { icon: Database, label: 'Dados\nEstruturados', color: 'var(--color-primary-400)' },
  { icon: UserCheck, label: 'Perfil + VDOT\nZonas', color: 'var(--color-secondary-400)' },
  { icon: FileText, label: 'Prompt\nInteligente', color: 'var(--color-secondary-neon)' },
  { icon: Cpu, label: 'Gemini\nAI', color: 'var(--color-primary-neon)' },
  { icon: CalendarDays, label: 'Plano\nSemanal', color: 'var(--color-secondary-neon)' },
];

export function TechSection() {
  return (
    <section className="relative py-20 lg:py-28 overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-[var(--color-secondary)] opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-6">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
            <GradientText variant="neon">Por baixo do capô</GradientText>
          </h2>
        </AnimatedSection>

        <AnimatedSection delay={100} className="text-center mb-16 max-w-3xl mx-auto">
          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
            Não é só mais um app de treino. É a primeira plataforma que conecta{' '}
            <span className="text-[var(--color-primary-neon)] font-semibold">dados reais de saúde</span>{' '}
            com{' '}
            <span className="text-[var(--color-secondary-neon)] font-semibold">metodologia científica</span>{' '}
            e{' '}
            <span className="text-[var(--color-text-primary)] font-semibold">inteligência artificial</span>.
          </p>
        </AnimatedSection>

        {/* Data flow diagram */}
        <AnimatedSection delay={200}>
          <div className="glass-primary rounded-3xl p-6 sm:p-10">
            {/* Desktop: horizontal flow */}
            <div className="hidden md:flex items-center justify-between gap-2">
              {flowSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex items-center gap-2 flex-1">
                    <div className="flex flex-col items-center text-center min-w-[80px] flex-1">
                      <div
                        className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05]"
                        style={{ boxShadow: `0 0 20px ${step.color}20` }}
                      >
                        <Icon className="h-7 w-7" style={{ color: step.color }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-tertiary)] whitespace-pre-line leading-tight">
                        {step.label}
                      </span>
                    </div>
                    {i < flowSteps.length - 1 && (
                      <div className="h-[2px] w-6 shrink-0 rounded-full bg-gradient-to-r from-[var(--color-primary-neon)] to-[var(--color-secondary-neon)] opacity-40 animate-neon-pulse" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile: vertical flow */}
            <div className="flex md:hidden flex-col items-center gap-2">
              {flowSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.05]"
                        style={{ boxShadow: `0 0 20px ${step.color}20` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: step.color }} />
                      </div>
                      <span className="text-sm text-[var(--color-text-tertiary)] whitespace-pre-line leading-tight w-32">
                        {step.label}
                      </span>
                    </div>
                    {i < flowSteps.length - 1 && (
                      <div className="w-[2px] h-6 rounded-full bg-gradient-to-b from-[var(--color-primary-neon)] to-[var(--color-secondary-neon)] opacity-40 my-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={350} className="text-center mt-10 max-w-2xl mx-auto">
          <p className="text-[var(--color-text-tertiary)] leading-relaxed">
            Construímos prompts com contexto real: seu histórico, suas zonas, sua saúde, sua
            aderência. Não é um chatbot genérico — é IA com dados do <span className="text-[var(--color-primary-neon)] font-semibold">SEU</span> corpo.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
