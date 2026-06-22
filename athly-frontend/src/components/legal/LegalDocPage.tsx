import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { GradientText } from "@/components/ui/GradientText";
import { companyInfo } from "@/config/company";
import type { ContentBlock, Lang, LegalDoc } from "@/config/legalContent";
import logoSrc from "@/assets/icons/main.png";

interface LegalDocPageProps {
  /** Bilingual document content. */
  docs: Record<Lang, LegalDoc>;
  /** Page <title>, e.g. "Privacy Policy - Athly". */
  documentTitle: string;
  /** Default language. */
  defaultLang?: Lang;
}

const LANG_LABELS: Record<Lang, string> = { pt: "PT", en: "EN" };
const LAST_UPDATED_LABEL: Record<Lang, string> = {
  pt: "Última atualização",
  en: "Last updated",
};

function isExternal(href: string): boolean {
  return /^(https?:|mailto:)/.test(href);
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="mt-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul className="mt-4 space-y-3">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="flex gap-3 text-base leading-relaxed text-[var(--color-text-secondary)]"
            >
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary-neon)]"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "link":
      return isExternal(block.href) ? (
        <a
          href={block.href}
          className="mt-4 inline-flex text-base font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
        >
          {block.label}
        </a>
      ) : (
        <Link
          to={block.href}
          className="mt-4 inline-flex text-base font-semibold text-[var(--color-primary-neon)] transition-colors hover:text-[var(--color-primary-300)]"
        >
          {block.label}
        </Link>
      );
  }
}

export function LegalDocPage({ docs, documentTitle, defaultLang = "pt" }: LegalDocPageProps) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  const doc = docs[lang];

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

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

          <div
            role="group"
            aria-label="Language"
            className="flex items-center gap-1 rounded-full border border-[var(--color-border-dark)] p-1"
          >
            {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  lang === code
                    ? "bg-[var(--color-primary-500)]/20 text-[var(--color-primary-neon)]"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {LANG_LABELS[code]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-[var(--color-primary-neon)] opacity-[0.06] blur-[110px]" />
            <div className="absolute -bottom-48 -right-32 h-[420px] w-[420px] rounded-full bg-[var(--color-secondary-neon)] opacity-[0.06] blur-[110px]" />
          </div>

          <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Badge variant="neon" size="sm" className="mb-6">
              {doc.badge}
            </Badge>

            <h1 className="font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              <GradientText variant="neon">{doc.title}</GradientText>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[var(--color-text-secondary)]">
              {doc.subtitle}
            </p>
            {doc.lastUpdated && (
              <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">
                {LAST_UPDATED_LABEL[lang]}: {doc.lastUpdated}
              </p>
            )}

            <div className="mt-12 space-y-12">
              {doc.sections.map((section) => (
                <section key={section.id} aria-labelledby={section.id}>
                  <h2
                    id={section.id}
                    className="font-display text-xl text-[var(--color-text-primary)] sm:text-2xl"
                  >
                    {section.heading}
                  </h2>
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </section>
              ))}
            </div>

            <footer className="mt-16 border-t border-[var(--color-border-dark)] pt-8 text-sm text-[var(--color-text-tertiary)]">
              &copy; {new Date().getFullYear()} {companyInfo.legalEntityName}
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
