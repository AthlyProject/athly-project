import type { RunTarget, Segment } from '../workouts/types/segment.types';
import type { WorkoutDay } from './types/planner.types';

/** RPE a partir do qual um bloco `work` é treino de qualidade (limiar, intervalos, ritmo de prova). */
export const QUALITY_RPE_MIN = 7;

/**
 * Garante que nenhum bloco de qualidade seja prescrito mais lento que o limiar já demonstrado
 * pelo atleta. O prompt já pede isso ("NUNCA prescreva um treino de qualidade mais lento do que
 * o atleta já demonstrou"), mas o modelo seguiu a tabela de zonas: depois de um bloco de limiar
 * de 2,5 km a 5:06, prescreveu limiar a 5:35–5:55.
 *
 * Só mexe em faixas inteiramente mais lentas que o piso (início da faixa > piso): a faixa é
 * deslocada para começar no piso, mantendo a largura. Faixas que já incluem o piso, ou mais
 * rápidas (intervalos, ritmo de prova), ficam como vieram. Muta `weekPlan` e devolve uma
 * descrição de cada ajuste para log.
 */
export function applyQualityPaceFloor(
  weekPlan: WorkoutDay[],
  floorSecPerKm: number | undefined,
): string[] {
  const adjustments: string[] = [];
  if (!floorSecPerKm || floorSecPerKm <= 0) return adjustments;
  const floor = Math.round(floorSecPerKm);

  const visit = (segments: Segment[] | undefined, day: WorkoutDay): void => {
    if (!Array.isArray(segments)) return;
    for (const segment of segments) {
      if (!segment || typeof segment !== 'object') continue;
      if (segment.kind === 'work') {
        const target = segment.target as RunTarget | undefined;
        if (
          target &&
          typeof target.rpe === 'number' &&
          target.rpe >= QUALITY_RPE_MIN &&
          isPositive(target.paceSecPerKmMin) &&
          isPositive(target.paceSecPerKmMax) &&
          target.paceSecPerKmMin > floor
        ) {
          const width = Math.max(0, target.paceSecPerKmMax - target.paceSecPerKmMin);
          adjustments.push(
            `${day.date} "${segment.label ?? segment.id}": ${target.paceSecPerKmMin}-${target.paceSecPerKmMax}s/km -> ${floor}-${floor + width}s/km`,
          );
          target.paceSecPerKmMin = floor;
          target.paceSecPerKmMax = floor + width;
        }
      }
      visit(segment.children, day);
    }
  };

  for (const day of weekPlan) {
    if (day.sportType !== 'running') continue;
    visit(day.segments, day);
  }
  return adjustments;
}

function isPositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
