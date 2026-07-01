import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GradientText } from '@/components/ui/GradientText';
import { Button } from '@/components/ui/Button';
import logoSrc from '@/assets/icons/main.png';

const publicLinks = [
  { label: 'Empresa', href: '/company' },
  { label: 'Privacidade', href: '/privacy' },
  { label: 'Termos', href: '/terms' },
  { label: 'Suporte', href: '/support' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass py-3' : 'py-5'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoSrc} alt="Athly" className="h-9 w-9" />
          <GradientText variant="neon" className="text-xl font-display">
            Athly
          </GradientText>
        </Link>
        <div className="hidden items-center gap-5 lg:flex">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Button variant="gradient" size="sm" glow onClick={scrollToWaitlist}>
          Entrar na lista
        </Button>
      </div>
    </nav>
  );
}
