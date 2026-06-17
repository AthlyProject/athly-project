import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Building2, ExternalLink, Globe2, Mail, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { GradientText } from "@/components/ui/GradientText";
import { companyDisclosure, companyInfo } from "@/config/company";
import logoSrc from "@/assets/icons/main.png";

const legalDetails = [
  {
    label: "Legal entity",
    value: companyInfo.legalEntityName,
    icon: Building2,
  },
  {
    label: companyInfo.registrationLabel,
    value: companyInfo.registrationNumber,
    icon: ShieldCheck,
  },
  {
    label: "Registered address",
    value: companyInfo.registeredAddress,
    icon: MapPin,
  },
  {
    label: "Country",
    value: companyInfo.country,
    icon: Globe2,
  },
];

export function CompanyPage() {
  useEffect(() => {
    document.title = "Company - Athly";
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-background-dark)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border-dark)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoSrc} alt="Athly" className="h-9 w-9" />
            <GradientText variant="neon" className="text-xl font-display">
              Athly
            </GradientText>
          </Link>
          <a
            href={`mailto:${companyInfo.supportEmail}`}
            className="text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
          >
            Contact support
          </a>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-[var(--color-primary-neon)] opacity-[0.06] blur-[110px]" />
            <div className="absolute -bottom-48 -right-32 h-[420px] w-[420px] rounded-full bg-[var(--color-secondary-neon)] opacity-[0.06] blur-[110px]" />
          </div>

          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Badge variant="neon" size="sm" className="mb-6">
              Official company information
            </Badge>

            <div className="max-w-3xl">
              <h1 className="font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
                <GradientText variant="neon">Athly Project</GradientText>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-secondary)]">
                {companyDisclosure}
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {legalDetails.map(({ label, value, icon: Icon }) => (
                <Card key={label} variant="flat" padding="lg" className="border border-[var(--color-border-dark)]">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-500)]/15 text-[var(--color-primary-neon)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-tertiary)]">{label}</p>
                      <p className="mt-1 break-words text-base font-semibold text-[var(--color-text-primary)]">
                        {value}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <Card variant="default" padding="lg">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-500)]/15 text-[var(--color-secondary-neon)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Business contact</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      For legal, developer account, App Store, or company verification matters.
                    </p>
                    <a
                      href={`mailto:${companyInfo.legalEmail}`}
                      className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
                    >
                      {companyInfo.legalEmail}
                    </a>
                  </div>
                </div>
              </Card>

              <Card variant="default" padding="lg">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-500)]/15 text-[var(--color-primary-neon)]">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Official domain</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      The official public website for Athly Project and related app information.
                    </p>
                    <a
                      href={companyInfo.websiteUrl}
                      className="mt-4 inline-flex text-sm font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
                    >
                      {companyInfo.websiteUrl}
                    </a>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
