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
    ? `Também é OBRIGATÓRIO target.hrZone: inteiro de 1 a 5. Use estas zonas de FC por reserva cardíaca, independentes das categorias de pace:
${zones.zones.map((z) => `Z${z.zone}: ${z.minBpm}–${z.maxBpm} bpm`).join('\n')}
${zones.isEstimated ? ESTIMATED_HEART_RATE_NOTICE : 'Zonas calculadas com os valores de FC configurados.'}
Escolha a zona; o backend preencherá os bpm e o aviso de estimativa. NÃO gere hrMinBpm, hrMaxBpm nem hrIsEstimated. NÃO escreva valores em bpm nos textos: eles serão exibidos pelos targets validados.`
    : 'Não há FC recente utilizável ou faltam dados para calcular zonas. Prescreva esforço por RPE. NÃO gere target.hrZone ou qualquer outro campo de FC, nem zonas de FC, bpm, percentuais de FC ou metas de frequência cardíaca em title, description, reasoning, label, cue ou notes. Histórico antigo de FC não habilita sua prescrição.'
}
Estas regras também se aplicam ao plano de avaliação e completam os targets dos exemplos de receitas. Sets e descanso passivo não recebem targets de FC.
</training_guidance>`;
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
      if (active && enabled && !zones.zones.some((z) => z.zone === target?.hrZone)) {
        defects.push(`${day.date}/${segment.id}: target.hrZone must select a supplied zone (1–5)`);
      }
      if (!enabled && target && Object.keys(target).some((key) => /^hr|heartRate/i.test(key))) {
        defects.push(`${day.date}/${segment.id}: RPE-only mode forbids HR targets`);
      }
    });
    const prose = textParts.filter(Boolean).join(' ');
    if (bpmText.test(prose) || (!enabled && heartRateText.test(prose))) {
      defects.push(
        `${day.date}: remove HR prescription from prose; use only authorized structured targets`,
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
        segment.kind !== 'rest' &&
        segment.kind !== 'set'
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
