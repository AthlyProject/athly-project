import { GradientText } from '@/components/ui/GradientText';
import { AnimatedSection } from './AnimatedSection';
import { X, Check } from 'lucide-react';

const problems = [
  'Treinos que ignoram seu histórico de corrida real',
  'Zonas de pace copiadas de tabelas genéricas da internet',
  'Planos que não sabem se você dormiu mal ou está com dor',
  'Sem adaptação: semana 1 = semana 10',
];

const solutions = [
  'Lê 20 treinos recentes do Apple Health e Health Connect',
  'Calcula 5 zonas VDOT calibradas para o SEU corpo',
  'Ajusta cada semana com base no que você completou e sentiu',
  'Cada treino com explicação da IA: por que esse treino, por que agora',
];

export function ProblemSection() {
  return (
    <section className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
            Planilhas genéricas não funcionam.{' '}
            <GradientText variant="neon">E você já sabe disso.</GradientText>
          </h2>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Problems */}
          <AnimatedSection delay={100}>
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-[var(--color-error-light)] mb-6 font-display">
                O que você encontra por aí
              </h3>
              {problems.map((text, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 glass rounded-2xl p-4 border-l-2 border-[var(--color-error)]/40"
                >
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-error)]" />
                  <p className="text-[var(--color-text-secondary)]">{text}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Solutions */}
          <AnimatedSection delay={250}>
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-[var(--color-primary-neon)] mb-6 font-display">
                O que a Athly faz diferente
              </h3>
              {solutions.map((text, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 glass-primary rounded-2xl p-4 border-l-2 border-[var(--color-primary-neon)]/40"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary-neon)]" />
                  <p className="text-[var(--color-text-secondary)]">{text}</p>
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
