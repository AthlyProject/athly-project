export type PlanLanguage = 'pt-BR' | 'en' | 'de';

/** Keep the header's order of preference; q=0 explicitly excludes an entry. */
export function normalizeLanguage(raw?: string | null): PlanLanguage {
  if (!raw?.trim()) return 'pt-BR';

  for (const entry of raw.split(',')) {
    const [tag, ...parameters] = entry.trim().split(';');
    const excluded = parameters.some((parameter) => {
      const [key, value] = parameter.trim().split('=');
      return key.toLowerCase() === 'q' && value?.trim() !== '' && Number(value) === 0;
    });
    if (excluded) continue;

    const base = tag.trim().toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en' || base === 'de') return base;
  }

  return 'en';
}

export function languageDisplayName(language: PlanLanguage): string {
  return {
    'pt-BR': 'Brazilian Portuguese (pt-BR)',
    en: 'English',
    de: 'German (Deutsch)',
  }[language];
}
