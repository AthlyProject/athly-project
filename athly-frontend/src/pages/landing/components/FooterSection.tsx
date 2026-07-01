import { Link } from 'react-router-dom';
import { GradientText } from '@/components/ui/GradientText';
import { companyDisclosure, companyInfo } from '@/config/company';
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
          <p className="max-w-2xl text-xs leading-relaxed text-[var(--color-text-disabled)]">
            {companyDisclosure}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link
              to="/company"
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Company
            </Link>
            <Link
              to="/privacy"
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Terms
            </Link>
            <Link
              to="/support"
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Support
            </Link>
            <a
              href={`mailto:${companyInfo.legalEmail}`}
              className="font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Legal
            </a>
          </div>
          <p className="text-xs text-[var(--color-text-disabled)]">
            &copy; {new Date().getFullYear()} {companyInfo.legalEntityName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
