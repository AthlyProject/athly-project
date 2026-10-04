/**
 * Árvore de segmentos de um `workouts.segments`. Aceita tanto o envelope
 * `{schemaVersion, sport, segments}` quanto um array puro (linhas antigas); `null` quando não há
 * árvore utilizável (coluna nula, `[]` ou formato desconhecido).
 */
export function extractSegmentTree(raw: unknown): any[] | null {
  if (Array.isArray(raw)) return raw.length > 0 ? raw : null;
  if (raw && typeof raw === 'object' && Array.isArray((raw as any).segments)) {
    const segs = (raw as any).segments;
    return segs.length > 0 ? segs : null;
  }
  return null;
}
