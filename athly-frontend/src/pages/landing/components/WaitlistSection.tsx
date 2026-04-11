import { GradientText } from '@/components/ui/GradientText';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AnimatedSection } from './AnimatedSection';
import { useWaitlist } from '../hooks/useWaitlist';
import { User, Mail, CheckCircle } from 'lucide-react';

export function WaitlistSection() {
  const { name, setName, email, setEmail, loading, success, error, handleSubmit } = useWaitlist();

  return (
    <section id="waitlist" className="relative py-20 lg:py-28">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[var(--color-primary-neon)] opacity-[0.05] blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-10">
          <Badge variant="neon" size="md" className="mb-6">
            Acesso Fundador — Vagas Limitadas
          </Badge>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-4">
            <GradientText variant="neon">Garanta seu lugar</GradientText>
          </h2>
          <p className="text-[var(--color-text-secondary)]">
            Deixe seu nome e email para ser notificado quando a plataforma abrir.
            Assinantes fundadores terão condições exclusivas.
          </p>
        </AnimatedSection>

        <AnimatedSection delay={150}>
          <Card variant="glow" padding="lg" className="glow-both">
            {success ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle className="mx-auto h-14 w-14 text-[var(--color-success)]" />
                <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">
                  Você está na lista!
                </h3>
                <p className="text-[var(--color-text-secondary)]">
                  Em breve entraremos em contato com condições exclusivas para fundadores.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Seu nome completo"
                  placeholder="João Silva"
                  icon={<User className="h-5 w-5" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                />
                <Input
                  label="Seu melhor email"
                  placeholder="joao@email.com"
                  type="email"
                  icon={<Mail className="h-5 w-5" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {error && (
                  <p className="text-sm text-[var(--color-error-light)] text-center">{error}</p>
                )}
                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  glow
                  fullWidth
                  loading={loading}
                >
                  Quero ser fundador
                </Button>
                <p className="text-xs text-[var(--color-text-disabled)] text-center">
                  Sem spam. Apenas atualizações sobre o lançamento.
                </p>
              </form>
            )}
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}
