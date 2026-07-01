import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Building2, ExternalLink, FileText, Globe2, Mail, MapPin, ShieldCheck } from "lucide-react";
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

const documentLinks = [
  {
    label: "Privacy Policy",
    description: "How Athly handles user data, HealthKit data, location, AI processing, and subscriptions.",
    href: "/privacy",
    icon: ShieldCheck,
  },
  {
    label: "Terms of Use",
    description: "Service rules, subscriptions, acceptable use, account responsibilities, and product limitations.",
    href: "/terms",
    icon: FileText,
  },
  {
    label: "Support",
    description: "Help, account deletion instructions, and direct support contact.",
    href: "/support",
    icon: Mail,
  },
];

export function CompanyPage() {
  useEffect(() => {
    document.title = "Company Information - Athly";
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
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/privacy"
              className="hidden text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)] sm:inline-flex"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="hidden text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)] sm:inline-flex"
            >
              Terms
            </Link>
            <a
              href={`mailto:${companyInfo.supportEmail}`}
              className="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-neon)]"
            >
              Contact support
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Badge variant="neon" size="sm" className="mb-6">
              Official public company website
            </Badge>

            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
                  <GradientText variant="neon">{companyInfo.productName}</GradientText>
                </h1>
                <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-secondary)]">
                  {companyDisclosure}
                </p>
                <p className="mt-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
                  Athly is a digital fitness product focused on personalized running plans,
                  workout tracking, Apple Health / HealthKit integration, and AI-assisted
                  training recommendations. This domain is maintained as the public website
                  for product information, company verification, user support, and legal
                  documents.
                </p>
              </div>

              <Card variant="default" padding="lg">
                <h2 className="font-display text-xl">Business contact</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  For App Store, developer account, legal, privacy, or company verification
                  matters, contact the company through the official email below.
                </p>
                <a
                  href={`mailto:${companyInfo.legalEmail}`}
                  className="mt-5 inline-flex break-all text-sm font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
                >
                  {companyInfo.legalEmail}
                </a>
              </Card>
            </div>

            <section className="mt-14" aria-labelledby="company-legal-details">
              <h2 id="company-legal-details" className="font-display text-2xl leading-tight sm:text-3xl">
                Legal company details
              </h2>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
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
            </section>

            <section className="mt-14 grid gap-5 lg:grid-cols-3" aria-label="Public documents">
              {documentLinks.map(({ label, description, href, icon: Icon }) => (
                <Card key={href} variant="default" padding="lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-secondary-500)]/15 text-[var(--color-secondary-neon)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-5 font-display text-xl">{label}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                  <Link
                    to={href}
                    className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
                  >
                    Open {label}
                  </Link>
                </Card>
              ))}
            </section>

            <section className="mt-14 grid gap-5 md:grid-cols-2">
              <Card variant="default" padding="lg">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-secondary-500)]/15 text-[var(--color-secondary-neon)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Support contact</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      For app support, account deletion, billing questions, or feedback.
                    </p>
                    <a
                      href={`mailto:${companyInfo.supportEmail}`}
                      className="mt-4 inline-flex break-all text-sm font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
                    >
                      {companyInfo.supportEmail}
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
                      Public website for Athly Project and the operating company information.
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
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
