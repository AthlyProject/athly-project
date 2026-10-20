import type { GuidedHeartRateZones } from '../users/heart-rate-guidance';
import type { RunTarget, Segment } from '../workouts/types/segment.types';
import type { WorkoutDay } from './types/planner.types';

export const ESTIMATED_HEART_RATE_NOTICE =
  'Zonas estimadas: o Apple Health não forneceu dados suficientes para definir sua FC máxima; usamos uma estimativa baseada na sua idade.';

export function heartRatePrescriptionPrompt(zones?: GuidedHeartRateZones): string {
  const enabled = zones?.trainingGuidance.mode === 'heart_rate_and_rpe';
  return `<training_guidance>
Modo de prescrição determinado pelo backend: ${enabled ? 'heart_rate_and_rpe' : 'rpe'}.
Em TODOS os segmentos ativos (warmup, work, recovery e cooldown), inclusive dentro de sets, target.rpe é OBRIGATÓRIO: inteiro de 1 a 10. Preserve o pace quando aplicável.
${
  enabled
    ? `Também é OBRIGATÓRIO target.hrZone (inteiro de 1 a 5) no aquecimento, na volta à calma e nos trechos de trabalho de 3 min ou mais. Tiros de menos de 3 min e recuperações NÃO recebem target.hrZone: a FC não chega à zona nem volta a tempo; prescreva esses trechos só por pace e RPE. Use estas zonas de FC por reserva cardíaca, independentes das categorias de pace:
${zones.zones.map((z) => `Z${z.zone}: ${z.minBpm}–${z.maxBpm} bpm`).join('\n')}
${zones.isEstimated ? ESTIMATED_HEART_RATE_NOTICE : 'Zonas calculadas com os valores de FC configurados.'}
Escolha a zona; o backend preencherá os bpm e o aviso de estimativa. NÃO gere hrMinBpm, hrMaxBpm nem hrIsEstimated. NÃO escreva valores em bpm nos textos: eles serão exibidos pelos targets validados.`
    : 'Não há FC recente utilizável ou faltam dados para calcular zonas. Prescreva esforço por RPE. NÃO gere target.hrZone ou qualquer outro campo de FC, nem zonas de FC, bpm, percentuais de FC ou metas de frequência cardíaca em title, description, reasoning, label, cue ou notes. Histórico antigo de FC não habilita sua prescrição.'
}
Estas regras também se aplicam ao plano de avaliação e completam os targets dos exemplos de receitas. Sets e descanso passivo não recebem targets de FC.
</training_guidance>`;
}

/** Trechos de trabalho mais curtos que isso não estabilizam a FC. */
export const SHORT_HEART_RATE_SECONDS = 180;
// Sem pace alvo, a distância decide: 800 m levam 3 min ou mais para quase todo corredor.
const SHORT_HEART_RATE_METERS = 800;

/**
 * Se o trecho recebe zona de FC. A FC leva 2–3 min para subir e para cair: num tiro curto ela não
 * chega à zona e numa recuperação não volta a tempo (eval 2026-10-20: 6×400 m em Z5 com 90 s em Z1).
 */
export function heartRateApplies(segment: Segment): boolean {
  if (segment.kind === 'warmup' || segment.kind === 'cooldown') return true;
  if (segment.kind !== 'work' || !segment.end) return segment.kind === 'work';
  const { by, value } = segment.end;
  if (by === 'durationSec') return value >= SHORT_HEART_RATE_SECONDS;
  if (by !== 'distanceM') return false;
  const { paceSecPerKmMin: min, paceSecPerKmMax: max } = (segment.target ?? {}) as RunTarget;
  const pace = min && max ? (min + max) / 2 : (min ?? max);
  return pace
    ? (value / 1000) * pace >= SHORT_HEART_RATE_SECONDS
    : value >= SHORT_HEART_RATE_METERS;
}

function visit(segments: Segment[], callback: (s: Segment) => void) {
  if (!Array.isArray(segments)) return;
  for (const segment of segments) {
    if (!segment || typeof segment !== 'object') continue;
    callback(segment);
    if (Array.isArray(segment.children)) visit(segment.children, callback);
  }
}

// Reject numeric HR prose even in enabled mode: the only BPM authority is the server snapshot.
const bpmText = /\bbpm\b|batimentos?\s*(?:por|minuto)|\d\s*%\s*(?:da\s*)?(?:fc|hr|frequência)/i;
const heartRateText =
  /\bz\s*[1-5]\b|\bzon[ae]\s*(?:de\s*(?:fc|frequência cardíaca)\s*)?[1-5]\b|\b(?:fc|hr)\b|frequência\s*cardíaca|heart\s*rate/i;

export function assessHeartRatePrescription(
  days: WorkoutDay[],
  zones?: GuidedHeartRateZones,
): string[] {
  const enabled = zones?.trainingGuidance.mode === 'heart_rate_and_rpe';
  const defects: string[] = [];
  for (const day of days) {
    const textParts = [day.title, day.description, day.reasoning];
    visit(day.segments ?? [], (segment) => {
      textParts.push(segment.label, segment.cue, segment.notes);
      const target = segment.target as RunTarget | undefined;
      const active =
        day.sportType !== 'other' &&
        ['warmup', 'work', 'recovery', 'cooldown'].includes(segment.kind);
      if (active && (!Number.isInteger(target?.rpe) || target!.rpe! < 1 || target!.rpe! > 10)) {
        defects.push(`${day.date}/${segment.id}: target.rpe must be an integer from 1 to 10`);
      }
      if (
        active &&
        enabled &&
        heartRateApplies(segment) &&
        !zones.zones.some((z) => z.zone === target?.hrZone)
      ) {
        defects.push(`${day.date}/${segment.id}: target.hrZone must select a supplied zone (1–5)`);
      }
      if (!enabled && target && Object.keys(target).some((key) => /^hr|heartRate/i.test(key))) {
        defects.push(`${day.date}/${segment.id}: RPE-only mode forbids HR targets`);
      }
    });
    const prose = textParts.filter(Boolean).join(' ');
    const match = bpmText.exec(prose) ?? (enabled ? null : heartRateText.exec(prose));
    if (match) {
      // O trecho vai no defeito: a nota corretiva diz o que remover e o log mostra o que disparou.
      const excerpt = prose.slice(Math.max(0, match.index - 40), match.index + 40).trim();
      defects.push(
        `${day.date}: remove HR prescription from prose ("…${excerpt}…"); use only authorized structured targets`,
      );
    }
  }
  return defects;
}

/** Freeze the same ranges shown in the profile at generation time. Never rewrite saved workouts. */
export function snapshotHeartRateTargets(days: WorkoutDay[], zones?: GuidedHeartRateZones): void {
  for (const day of days) {
    let hasHeartRate = false;
    visit(day.segments ?? [], (segment) => {
      const target = segment.target as RunTarget | undefined;
      if (!target) return;
      delete target.hrMinBpm;
      delete target.hrMaxBpm;
      delete target.hrIsEstimated;
      const zone =
        zones?.trainingGuidance.mode === 'heart_rate_and_rpe' &&
        day.sportType !== 'other' &&
        heartRateApplies(segment)
          ? zones.zones.find((z) => z.zone === target.hrZone)
          : undefined;
      if (zone) {
        target.hrMinBpm = zone.minBpm;
        target.hrMaxBpm = zone.maxBpm;
        target.hrIsEstimated = zones!.isEstimated;
        hasHeartRate = true;
      } else {
        delete target.hrZone;
      }
    });
    if (hasHeartRate && zones?.isEstimated) {
      day.description = `${day.description}\n${ESTIMATED_HEART_RATE_NOTICE}`;
    }
  }
}
