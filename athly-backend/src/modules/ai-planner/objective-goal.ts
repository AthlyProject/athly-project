/**
 * Adaptador do motor objetivo (`goal-feasibility-v2`) para a geração de planos: monta a evidência
 * a partir das corridas do Health, avalia a meta com data e traduz o resultado para o veredito
 * legado (formato que o app já lê) e para o prompt.
 *
 * O veredito de VDOT do v1 continua projetando o tempo; o motor objetivo acrescenta o que ele não
 * via: a resistência para a distância (volume e maior corrida recentes) e a confiança dos dados.
 */
import {
  ENGINE_VERSION,
  assessGoal,
  normalizeObjectiveEvidence,
  type Confidence,
  type GoalAssessment,
  type GoalSupport,
  type ObjectiveEvidence,
  type ObjectiveRunInput,
} from './goal-feasibility-v2';
import type { FeasibilityVerdict, GoalFeasibility } from './goal-feasibility';
import type { HealthRunItemDto } from './dto/plan-from-health.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
// Sem atingir o limite de leitura, o app trouxe todas as corridas legíveis; um ano cobre com folga
// as janelas do motor (até 8 semanas).
const FULL_HISTORY_DAYS = 365;
// Prova a até 4 semanas: não há tempo de construir a resistência que falta.
const SHORT_NOTICE_DAYS = 28;

const iso = (value: string | Date) => new Date(value).toISOString();
const km = (meters: number | null) => (meters === null ? null : Math.round(meters / 100) / 10);

/**
 * Evidência objetiva a partir das corridas do Health (as N mais recentes que o app leu). Devolve
 * null para clientes antigos, que não mandam a origem do registro: sem ela nenhuma corrida vira
 * medida e o veredito fica só no VDOT, como antes.
 */
export function healthObjectiveEvidence(params: {
  userId: string;
  runs: HealthRunItemDto[];
  asOf: Date;
  timeZone: string;
  readLimit: number;
  /** Desde quando o app leu todas as corridas (leitura por janela). Clientes antigos não mandam. */
  readFrom?: Date | null;
  /** Quando o app leu o Health. Corridas do contexto salvo têm a data dele; sem ela, `asOf`. */
  capturedAt?: Date | null;
}): ObjectiveEvidence | null {
  const { userId, runs, asOf, timeZone, readLimit, readFrom } = params;
  if (runs.length > 0 && !runs.some((r) => r.sourceBundleIdentifier !== undefined)) return null;
  const readAt = params.capturedAt ?? asOf;
  const capturedAt = iso(readAt);
  const starts = runs.map((r) => Date.parse(r.startDate)).filter(Number.isFinite);
  // O app atual informa desde quando leu tudo. O antigo lê as N mais recentes: com N atingido,
  // tudo desde a mais antiga está lá.
  const from =
    readFrom && Number.isFinite(readFrom.getTime())
      ? readFrom.getTime()
      : runs.length >= readLimit && starts.length
        ? Math.min(...starts)
        : readAt.getTime() - FULL_HISTORY_DAYS * DAY_MS;
  const requestedFrom = iso(new Date(Math.min(from, readAt.getTime() - 1000)));
  const state = runs.length ? 'complete' : 'empty';
  return normalizeObjectiveEvidence({
    userId,
    asOf: iso(asOf),
    timeZone,
    lastReadState: state,
    capture: {
      userId,
      capturedAt,
      coverage: {
        schemaVersion: 1,
        state,
        requestedFrom,
        requestedTo: capturedAt,
        coveredIntervals: [{ from: requestedFrom, to: capturedAt }],
        truncated: false,
        failureCode: null,
        // O app não afirma que toda corrida foi registrada: sem isso o motor nunca conclui
        // "não sustenta", só "não demonstrado".
        assertion: null,
      },
      runs: runs.map((run, index) => toObjectiveRun(userId, run, index)),
    },
  });
}

function toObjectiveRun(userId: string, run: HealthRunItemDto, index: number): ObjectiveRunInput {
  const uuid = run.appleHealthWorkoutUUID;
  return {
    userId,
    id: uuid ?? `run-${index}-${iso(run.startDate)}`,
    sourceId: uuid && UUID.test(uuid) ? uuid.toLowerCase() : null,
    sourceRevision: 0,
    startDate: iso(run.startDate),
    distanceMeters: run.distanceMeters,
    durationSeconds: run.durationSeconds,
    observation: {
      schemaVersion: 1,
      // O app só lê treinos de corrida do HealthKit, com a distância total do treino.
      measurementSource: 'healthkit_workout',
      sourceBundleIdentifier: run.sourceBundleIdentifier ?? null,
      userEntered: run.wasUserEntered ?? null,
      activityKind: 'running',
      distanceBasis: 'workout_total',
      endDate: run.endDate ? iso(run.endDate) : null,
      durationBasis: 'active',
      pauses: { method: 'not_checked', intervals: null },
    },
    assertion: null,
    linkedWorkout: null,
    parentSourceId: null,
    withdrawn: false,
    segments: [],
  };
}

/** Avalia a meta com data e distância. Null quando a meta não se aplica ou a entrada é inválida. */
export function assessDatedGoal(params: {
  distanceMeters: number | null;
  timeSeconds: number | null;
  eventDate: string | null;
  evidence: ObjectiveEvidence;
}): GoalAssessment | null {
  const { distanceMeters, timeSeconds, eventDate, evidence } = params;
  if (!eventDate || distanceMeters === null) return null;
  try {
    return assessGoal(
      { modality: 'running', distanceMeters, timeSeconds, eventDate, timeZone: evidence.timeZone },
      evidence,
    );
  } catch {
    return null;
  }
}

export interface ObjectiveSummary {
  engineVersion: typeof ENGINE_VERSION;
  current: GoalSupport;
  byDate: GoalSupport | 'conditional';
  confidence: Confidence;
  daysAvailable: number | null;
  endurance: {
    state: GoalSupport | 'not_applicable';
    /** Null quando as semanas da janela não estão cobertas por inteiro. */
    weeklyKm: number | null;
    requiredWeeklyKm: number | null;
    longestKm: number | null;
    requiredLongestKm: number | null;
  };
  performance: {
    state: GoalSupport | 'not_applicable';
    observedVdot: number | null;
    requiredVdot: number | null;
  };
}

export function summarizeAssessment(assessment: GoalAssessment): ObjectiveSummary {
  const fact = (name: string) => {
    const value = assessment.assessment.endurance.reasons
      .flatMap((r) => r.facts)
      .find((f) => f.name === name)?.value;
    return typeof value === 'number' ? value : null;
  };
  const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
  return {
    engineVersion: ENGINE_VERSION,
    current: assessment.assessment.current,
    byDate: assessment.assessment.byDate,
    confidence: assessment.assessment.confidence,
    daysAvailable: assessment.daysAvailable,
    endurance: {
      state: assessment.assessment.endurance.state,
      weeklyKm: km(fact('weeklyMeters')),
      requiredWeeklyKm: km(fact('requiredWeeklyMeters')),
      longestKm: km(fact('largestSessionMeters')),
      requiredLongestKm: km(fact('requiredLargestSessionMeters')),
    },
    performance: {
      state: assessment.assessment.performance.state,
      observedVdot: round1(assessment.performance.observedEquivalentVdot),
      requiredVdot: round1(assessment.performance.requiredVdot),
    },
  };
}

export type CombinedFeasibility = GoalFeasibility & { assessment?: ObjectiveSummary };

/**
 * Junta o veredito de VDOT (v1) com o motor objetivo, no formato que o app já lê:
 * - "pronto" exige o motor objetivo confirmar resistência e desempenho; senão vira "viável", ou
 *   "ambicioso" se a prova está a até 4 semanas e falta resistência;
 * - "viável" com a prova a até 4 semanas e sem resistência demonstrada vira "ambicioso";
 * - sem evidência objetiva para a distância (confiança "none") a estimativa é preliminar. A
 *   confiança "low" fica só no JSON: ela vem de cobertura incompleta (cliente antigo, que lê só
 *   as 20 corridas mais recentes) ou de falta de corrida recente, e "registre mais corridas" (o
 *   texto do app) não ajudaria.
 * Sem avaliação objetiva (cliente antigo), o v1 segue como está.
 */
export function combineFeasibility(
  v1: GoalFeasibility,
  assessment: GoalAssessment | null,
): CombinedFeasibility {
  if (!assessment) return v1;
  const summary = summarizeAssessment(assessment);
  const enduranceShort = summary.endurance.state !== 'supported';
  const shortNotice = summary.daysAvailable !== null && summary.daysAvailable <= SHORT_NOTICE_DAYS;
  let verdict: FeasibilityVerdict = v1.verdict;
  if (verdict === 'ready' && summary.current !== 'supported') {
    verdict = shortNotice && enduranceShort ? 'ambitious' : 'feasible';
  } else if (verdict === 'feasible' && shortNotice && enduranceShort) {
    verdict = 'ambitious';
  }
  return {
    ...v1,
    verdict,
    lowConfidence: v1.lowConfidence || summary.confidence === 'none',
    assessment: summary,
  };
}

/** Bloco do prompt sobre a resistência para a distância da prova (metas com data). */
export function goalReadinessPrompt(summary: ObjectiveSummary, raceKm: number): string {
  const e = summary.endurance;
  const supported = e.state === 'supported';
  const longest =
    e.longestKm && e.longestKm > 0
      ? `maior corrida recente ${e.longestKm} km (referência: ${e.requiredLongestKm} km, 75% da prova)`
      : 'nenhuma corrida recente registrada';
  const weekly =
    e.weeklyKm === null
      ? 'volume semanal sem semanas completas para medir'
      : `volume semanal ${e.weeklyKm} km (referência: ${e.requiredWeeklyKm} km, 1,5 × a prova)`;
  const days = summary.daysAvailable;
  const lines = [
    '<goal_readiness>',
    'Prontidão para a distância da prova, calculada pelo backend a partir das corridas registradas:',
    `- Resistência para ${raceKm} km: ${supported ? 'demonstrada' : 'NÃO demonstrada'} — ${longest}; ${weekly}.`,
    `- A prova é em ${days} dia(s).`,
  ];
  if (!supported && days !== null && days <= SHORT_NOTICE_DAYS) {
    lines.push(
      'A prova está perto demais para construir essa resistência. No fitnessInsights, diga isso ao atleta com clareza e com esses números, sem alarmismo. Planeje para ele chegar inteiro e completar a prova com segurança (ritmo conservador, pausas de caminhada se precisar). NÃO tente recuperar nesta semana o volume que falta.',
    );
  } else if (!supported) {
    lines.push(
      'Há tempo para construir a resistência: priorize o longão e o volume fácil ao longo do ciclo e não trate a meta como garantida no fitnessInsights.',
    );
  }
  lines.push('</goal_readiness>');
  return lines.join('\n');
}
