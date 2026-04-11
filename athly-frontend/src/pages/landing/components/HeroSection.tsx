import { GradientText } from "@/components/ui/GradientText";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AnimatedSection } from "./AnimatedSection";

interface HeroSectionProps {
  mascotSrc?: string;
}

export function HeroSection({ mascotSrc }: HeroSectionProps) {
  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[var(--color-primary-neon)] opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[var(--color-secondary-neon)] opacity-[0.07] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-[var(--color-primary)] opacity-[0.04] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — Text */}
          <div className="space-y-8">
            <AnimatedSection>
              <Badge variant="neon" size="sm" className="mb-4">
                Acesso Antecipado
              </Badge>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight tracking-tight">
                Seu treino deveria entender seu corpo.{" "}
                <GradientText variant="neon" animated className="block mt-1">
                  Agora entende.
                </GradientText>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={150}>
              <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                A Athly lê seus dados reais de saúde direto do Apple Health e
                Health Connect, calcula suas zonas científicas de esforço, e usa
                IA para criar planos que se adaptam a cada semana da sua
                evolução.
              </p>
            </AnimatedSection>

            <AnimatedSection delay={300}>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <Button
                  variant="gradient"
                  size="lg"
                  glow
                  onClick={scrollToWaitlist}
                >
                  Quero acesso antecipado
                </Button>
                <p className="text-sm text-[var(--color-text-tertiary)] self-center">
                  Vagas limitadas para assinantes fundadores
                </p>
              </div>
            </AnimatedSection>
          </div>

          {/* Right — Mascot */}
          {mascotSrc && (
            <AnimatedSection
              delay={400}
              className="hidden lg:flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-primary-neon)] to-[var(--color-secondary-neon)] opacity-20 blur-[60px] scale-75" />
                <img
                  src={mascotSrc}
                  alt="Athly mascot"
                  className="relative w-200 xl:w-270 animate-float drop-shadow-2xl"
                  loading="eager"
                />
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
}
