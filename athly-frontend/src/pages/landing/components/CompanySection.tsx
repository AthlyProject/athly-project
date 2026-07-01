import { Building2, ExternalLink, FileText, Mail, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { GradientText } from "@/components/ui/GradientText";
import { companyInfo } from "@/config/company";

const legalDetails = [
  {
    label: "Razão social",
    value: companyInfo.legalEntityName,
    icon: Building2,
  },
  {
    label: companyInfo.registrationLabel,
    value: companyInfo.registrationNumber,
    icon: ShieldCheck,
  },
  {
    label: "Endereço registrado",
    value: `${companyInfo.registeredAddress}, ${companyInfo.country}`,
    icon: MapPin,
  },
  {
    label: "Contato oficial",
    value: companyInfo.legalEmail,
    icon: Mail,
  },
];

const publicLinks = [
  { label: "Empresa", href: "/company", icon: Building2 },
  { label: "Privacidade", href: "/privacy", icon: ShieldCheck },
  { label: "Termos", href: "/terms", icon: FileText },
  { label: "Suporte", href: "/support", icon: Mail },
];

export function CompanySection() {
  return (
    <section id="company" className="border-y border-[var(--color-border-dark)] bg-white/[0.015] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <Badge variant="neon" size="sm" className="mb-5">
              Site oficial
            </Badge>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">
              <GradientText variant="neon">Athly Project</GradientText>{" "}
              e informações públicas da empresa.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-secondary)] sm:text-lg">
              O Athly é um produto digital de treino personalizado desenvolvido e operado pela{" "}
              <strong className="font-semibold text-[var(--color-text-primary)]">
                {companyInfo.legalEntityName}
              </strong>
              {"."} Este domínio é o site público oficial para informações do produto, contato,
              suporte e documentos legais.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {publicLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-dark)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-neon)] hover:text-[var(--color-primary-neon)]"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              <a
                href={companyInfo.websiteUrl}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border-dark)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary-neon)] hover:text-[var(--color-primary-neon)]"
              >
                <ExternalLink className="h-4 w-4" />
                {companyInfo.domainName}
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </div>
    </section>
  );
}
