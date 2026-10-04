const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/[×✕✖]/g, 'x'],
  [/[‐‑‒–—―−]/g, '-'],
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/…/g, '...'],
];

/** Fora do Latin-1 imprimível (emoji, símbolos, controles) o relógio não tem glifo. */
const isDisplayable = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x20 && code <= 0xff && !(code >= 0x7f && code < 0xa0);
};

/**
 * Normaliza um texto para os campos string do FIT (nome do treino, passos, notas): troca
 * pontuação tipográfica por ASCII, descarta o que o relógio não desenha, colapsa espaços e corta
 * em `maxLength` caracteres (não bytes — acentos continuam inteiros).
 */
export function sanitizeFitText(input: string | null | undefined, maxLength: number): string {
  if (!input) return '';
  let text = input.normalize('NFC');
  for (const [pattern, replacement] of REPLACEMENTS) text = text.replace(pattern, replacement);
  const displayable = Array.from(text.replace(/\s+/g, ' '))
    .filter(isDisplayable)
    .join('')
    .replace(/ {2,}/g, ' ')
    .trim();
  return Array.from(displayable).slice(0, maxLength).join('').trim();
}
