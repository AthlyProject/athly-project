/** Faixa de pace em s/km: `minSecPerKm` é o limite rápido, `maxSecPerKm` o lento. */
export interface PaceRange {
  minSecPerKm: number;
  maxSecPerKm: number;
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
