/**
 * Análise da meta antes do plano (puro): alternativas na mesma data e o texto da tela.
 *
 * As alternativas usam o motor objetivo (`goal-feasibility-v2`), mas só em distâncias de prova
 * (5k, 10k, 15k, meia, maratona): a grade de 100 m do `goalAlternatives` sugeria "13,3 km" e custava
 * até ~1.200 avaliações por chamada. Cada candidato só entra se o motor confirmar a meta
 * (`supported`) com confiança média, como no `goalAlternatives`. Sem alternativa do motor, a
 * projeção do VDOT (motor v1) oferece o tempo realista na mesma data — nunca outra data.
 */
import { distanceLabel } from '../goals/goal-builder';
import type { GoalFeasibility } from './goal-feasibility';
import {
  assessGoal,
  eligibleIndex,
  equivalentSeconds,
  type GoalAssessment,
  type GoalTarget,
  type ObjectiveEvidence,
} from './goal-feasibility-v2';
import type { CombinedFeasibility, ObjectiveSummary } from './objective-goal';

/** Distâncias de prova das alternativas, com a chave do onboarding. */
export const RACE_DISTANCES = [
  { meters: 5000, key: '5k' },
  { meters: 10000, key: '10k' },
  { meters: 15000, key: '15k' },
  { meters: 21097.5, key: 'half' },
  { meters: 42195, key: '42k' },
] as const;

const MAX_HORIZON_DAYS = 365;

/** Meta no formato do onboarding: o corpo de `PUT /goals/active`. */
export interface GoalDraft {
  objectiveDistance: string;
  objectiveType: 'target_time' | 'workload';
  targetTime?: string;
  eventDate?: string;
}

export interface AnalysisAlternative {
  id: string;
  axis: 'time' | 'distance' | 'both';
  /** objective = confirmada pelo motor objetivo; projection = tempo projetado pelo VDOT. */
  source: 'objective' | 'projection';
  summary: string;
  goal: GoalDraft;
}

/** Tempo de meta no formato do app: H:MM:SS a partir de 1 hora, senão MM:SS. */
export function formatGoalTime(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Quilômetros em pt-BR: 15,8 km. */
const km = (value: number) => `${value.toFixed(value % 1 ? 1 : 0).replace('.', ',')} km`;

const raceKey = (meters: number) => RACE_DISTANCES.find((d) => d.meters === meters)?.key ?? null;
const roundUp30 = (seconds: number) => Math.ceil(seconds / 30) * 30;

function alternative(
  axis: AnalysisAlternative['axis'],
  source: AnalysisAlternative['source'],
  distanceKey: string,
  timeSeconds: number | null,
  eventDate: string,
): AnalysisAlternative {
  const time = timeSeconds === null ? null : formatGoalTime(timeSeconds);
  const label = distanceLabel(distanceKey);
  return {
    id: `${axis}-${distanceKey}-${time ?? 'completar'}`,
    axis,
    source,
    summary: time ? `${label} em ${time} no mesmo dia` : `Completar ${label} no mesmo dia`,
    goal: {
      objectiveDistance: distanceKey,
      objectiveType: time ? 'target_time' : 'workload',
      ...(time ? { targetTime: time } : {}),
      eventDate,
    },
  };
}

/**
 * Até 3 alternativas confirmadas pelo motor objetivo, na mesma data: outro tempo na mesma
 * distância; a maior distância de prova menor com o tempo equivalente; e a maior distância de
 * prova menor para completar, sem tempo alvo. O motor mantém o tempo da meta no eixo da
 * distância ("13,3 km em 1:30:00"), mas numa prova padrão isso não diz nada ("10K em 1:30:00").
 * Quando as duas últimas caem na mesma prova, fica só a do tempo equivalente.
 */
export function raceAlternatives(
  target: GoalTarget,
  evidence: ObjectiveEvidence,
  original: GoalAssessment = assessGoal(target, evidence),
): AnalysisAlternative[] {
  const distance = target.distanceMeters;
  if (
    !evidence.fresh ||
    distance === null ||
    target.eventDate === null ||
    original.assessment.current === 'supported' ||
    original.assessment.current === 'unavailable' ||
    original.daysAvailable === null ||
    original.daysAvailable <= 0 ||
    original.daysAvailable > MAX_HORIZON_DAYS
  ) {
    return [];
  }
  const confirmed = (candidate: GoalTarget) => {
    const { current, confidence } = assessGoal(candidate, evidence).assessment;
    return current === 'supported' && (confidence === 'medium' || confidence === 'high');
  };
  // Tempo equivalente ao melhor esforço recente, arredondado para cima em 30 s (+30 s se o
  // motor ainda não confirmar), como o `goalAlternatives`.
  const confirmedTime = (meters: number): number | null => {
    const effort = eligibleIndex(evidence, meters);
    const seconds = effort ? equivalentSeconds(effort.index, meters) : null;
    if (seconds === null) return null;
    const first = roundUp30(seconds);
    for (const candidate of [first, first + 30]) {
      if (confirmed({ ...target, distanceMeters: meters, timeSeconds: candidate }))
        return candidate;
    }
    return null;
  };

  const out: AnalysisAlternative[] = [];
  const key = raceKey(distance);
  if (target.timeSeconds !== null && key) {
    const time = confirmedTime(distance);
    if (time !== null && time - target.timeSeconds >= 30) {
      out.push(alternative('time', 'objective', key, time, target.eventDate));
    }
  }
  const shorter = RACE_DISTANCES.filter((d) => d.meters < distance - 100)
    .map((d) => d.meters)
    .sort((a, b) => b - a);
  const toComplete = shorter.find((meters) =>
    confirmed({ ...target, distanceMeters: meters, timeSeconds: null }),
  );
  let equivalent: { meters: number; time: number } | null = null;
  if (target.timeSeconds !== null) {
    for (const meters of shorter) {
      const time = confirmedTime(meters);
      if (time !== null && Math.abs(time - target.timeSeconds) >= 30) {
        equivalent = { meters, time };
        break;
      }
    }
  }
  if (equivalent) {
    out.push(
      alternative(
        'both',
        'objective',
        raceKey(equivalent.meters)!,
        equivalent.time,
        target.eventDate,
      ),
    );
  }
  if (toComplete !== undefined && toComplete !== equivalent?.meters) {
    out.push(alternative('distance', 'objective', raceKey(toComplete)!, null, target.eventDate));
  }
  return out;
}
/** Sem alternativa do motor objetivo: o tempo que a projeção do VDOT dá para a mesma data. */
export function projectionAlternative(
  v1: GoalFeasibility | null,
  goal: { targetDistance: string | null; eventDate: string | null },
): AnalysisAlternative | null {
  const realistic = v1?.suggestion?.realisticTimeSec;
  if (!v1 || !realistic || !goal.eventDate || !goal.targetDistance) return null;
  if (v1.verdict !== 'ambitious' && v1.verdict !== 'unrealistic') return null;
  const time = roundUp30(realistic);
  if (time - v1.targetTimeSec < 30) return null;
  return alternative('time', 'projection', goal.targetDistance, time, goal.eventDate);
}

export interface AnalysisTextInput {
  goal: { targetDistance: string | null; targetTime: string | null; eventDate: string | null };
  hasHistory: boolean;
  feasibility: CombinedFeasibility | null;
  readiness: ObjectiveSummary | null;
}

/** Título e texto da análise, em pt-BR e determinísticos (a IA só escreve com o plano). */
export function analysisText(input: AnalysisTextInput): { title: string; message: string } {
  const { goal, hasHistory, feasibility, readiness } = input;
  const label = goal.targetDistance ? distanceLabel(goal.targetDistance) : 'a prova';
  if (!hasHistory) {
    return {
      title: 'Vamos conhecer o seu ritmo',
      message:
        'Ainda não há corridas suas no Apple Health. A primeira semana é de avaliação, por tempo e ' +
        'esforço, sem pace alvo; depois dela, a análise passa a usar os seus números.',
    };
  }
  const parts: string[] = [];
  let title: string;
  const projected = feasibility?.suggestion?.realisticTimeSec ?? null;
  switch (feasibility?.verdict) {
    case 'ready':
      title = 'Meta ao seu alcance';
      parts.push('Pelo seu histórico, você já corre no ritmo da meta.');
      break;
    case 'feasible':
      title = 'Meta viável até a prova';
      parts.push(
        `Com ${feasibility.weeksAvailable} semana(s) de treino, a projeção chega ao ritmo da meta.`,
      );
      break;
    case 'ambitious':
      title = 'Meta ambiciosa';
      parts.push(
        projected
          ? `A projeção para o dia da prova é ${formatGoalTime(projected)}, perto da meta: dá para tentar, com risco.`
          : 'A projeção fica perto da meta: dá para tentar, com risco.',
      );
      break;
    case 'unrealistic':
      title = 'Meta difícil para esta data';
      parts.push(
        projected
          ? `Até a prova, a projeção é ${formatGoalTime(projected)}, acima da meta de ${goal.targetTime}.`
          : 'Até a prova, a projeção fica longe do tempo da meta.',
      );
      break;
    default:
      title =
        readiness?.endurance.state === 'supported'
          ? 'Resistência confirmada'
          : 'Resistência ainda não demonstrada';
  }
  if (readiness && readiness.endurance.state !== 'not_applicable') {
    const e = readiness.endurance;
    if (e.state === 'supported') {
      parts.push(`Seus treinos recentes já mostram resistência para ${label}.`);
    } else {
      const longest =
        e.longestKm && e.longestKm > 0
          ? `sua maior corrida recente foi de ${km(e.longestKm)}`
          : 'não há corrida recente registrada';
      parts.push(
        `Ainda não vimos resistência para ${label}: ${longest}` +
          (e.requiredLongestKm ? `, e a referência é ${km(e.requiredLongestKm)}.` : '.'),
      );
    }
  }
  if (feasibility?.lowConfidence) {
    parts.push('É uma estimativa preliminar: fica mais precisa conforme você registra corridas.');
  }
  return { title, message: parts.join(' ') };
}
