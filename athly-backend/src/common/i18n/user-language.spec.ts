import { languageDisplayName, normalizeLanguage } from './user-language';

describe('normalizeLanguage', () => {
  it.each([
    [undefined, 'pt-BR'],
    [null, 'pt-BR'],
    ['', 'pt-BR'],
    ['   ', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['pt-BR', 'pt-BR'],
    ['pt-PT', 'pt-BR'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['de', 'de'],
    ['de-DE', 'de'],
    [' DE-at ', 'de'],
    ['fr-FR', 'en'],
    ['deutsch', 'en'],
    ['*', 'en'],
    ['fr-FR, de-DE;q=0.8, en;q=0.9', 'de'],
    ['de;q=0.1, en;q=1', 'de'],
    ['fr, pt-BR;q=0.8, en;q=0.7', 'pt-BR'],
    ['de;q=0, en;q=0.8', 'en'],
    ['de; Q=0.0, pt;q=1', 'pt-BR'],
    ['pt;q=0', 'en'],
    ['fr;q=1, es;q=0.9', 'en'],
    [', , de-DE ; q=0.8', 'de'],
  ])('normalizes %p to %s', (raw, expected) => {
    expect(normalizeLanguage(raw)).toBe(expected);
  });
});

describe('languageDisplayName', () => {
  it('uses explicit names for all supported prompt languages', () => {
    expect(languageDisplayName('pt-BR')).toBe('Brazilian Portuguese (pt-BR)');
    expect(languageDisplayName('en')).toBe('English');
    expect(languageDisplayName('de')).toBe('German (Deutsch)');
  });
});
