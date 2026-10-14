/** Faixa de pace em s/km: `minSecPerKm` é o limite rápido, `maxSecPerKm` o lento. */
export interface PaceRange {
  minSecPerKm: number;
  maxSecPerKm: number;
}

/**
 * Largura mínima de uma faixa de pace: 20 s/km ou 6% do pace, o que for maior. O pace
 * instantâneo do GPS oscila ±5–10 s/km (mais em paces lentos), então uma faixa de 10 s faz o
 * relógio alertar o tempo todo mesmo com o atleta no ritmo certo.
 */
export const MIN_PACE_WINDOW_SEC = 20;
export const MIN_PACE_WINDOW_RATIO = 0.06;

export function minPaceWindowSec(midSecPerKm: number): number {
  return Math.max(MIN_PACE_WINDOW_SEC, Math.round(midSecPerKm * MIN_PACE_WINDOW_RATIO));
}

/** Alarga, em volta do meio, uma faixa mais estreita que `minPaceWindowSec`. */
export function widenPaceRange(range: PaceRange): PaceRange {
  const lo = Math.min(range.minSecPerKm, range.maxSecPerKm);
  const hi = Math.max(range.minSecPerKm, range.maxSecPerKm);
  const mid = (lo + hi) / 2;
  const width = minPaceWindowSec(mid);
  if (hi - lo >= width) return { minSecPerKm: lo, maxSecPerKm: hi };
  return { minSecPerKm: Math.floor(mid - width / 2), maxSecPerKm: Math.ceil(mid + width / 2) };
}

/**
 * Faixa de pace a partir de valores soltos (s/km). Valores não positivos são ignorados; um alvo
 * único (mín == máx) vira uma faixa de ±`padSec` para não exigir um pace exato.
 */
export function paceRangeOf(values: number[], padSec = 10): PaceRange | undefined {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return undefined;
  const lo = Math.min(...valid);
  const hi = Math.max(...valid);
  return lo === hi
    ? { minSecPerKm: lo - padSec, maxSecPerKm: hi + padSec }
    : { minSecPerKm: lo, maxSecPerKm: hi };
}

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Alarga, in place, toda faixa de pace (mín e máx) estreita demais numa árvore de segmentos.
 * Alvos de valor único ficam como estão — quem consome já aplica a folga.
 */
export function widenSegmentPaceTargets(segments: unknown): void {
  if (!Array.isArray(segments)) return;
  for (const segment of segments) {
    if (!segment || typeof segment !== 'object') continue;
    const { target, children } = segment as { target?: unknown; children?: unknown };
    if (target && typeof target === 'object') {
      const t = target as { paceSecPerKmMin?: unknown; paceSecPerKmMax?: unknown };
      if (isPositive(t.paceSecPerKmMin) && isPositive(t.paceSecPerKmMax)) {
        const range = widenPaceRange({
          minSecPerKm: t.paceSecPerKmMin,
          maxSecPerKm: t.paceSecPerKmMax,
        });
        t.paceSecPerKmMin = range.minSecPerKm;
        t.paceSecPerKmMax = range.maxSecPerKm;
      }
    }
    widenSegmentPaceTargets(children);
  }
}
