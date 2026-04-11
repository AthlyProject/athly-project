import { GradientText } from '@/components/ui/GradientText';
import logoSrc from '@/assets/icons/main.png';

export function FooterSection() {
  return (
    <footer className="border-t border-[var(--color-border-dark)] py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="Athly" className="h-8 w-8" />
            <GradientText variant="neon" className="text-lg font-display">
              Athly
            </GradientText>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Treino inteligente, movido por IA e ciência.
          </p>
          <p className="text-xs text-[var(--color-text-disabled)]">
            &copy; {new Date().getFullYear()} Athly. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
