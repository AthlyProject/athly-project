import type { FitIntensity, FitWorkoutPlan, FitWorkoutStep } from './workout-fit-plan';

/** Alvo de um passo no player do app Athly no relógio. */
export type WatchPlanTarget =
  | { type: 'pace'; fastSecPerKm: number; slowSecPerKm: number }
  | { type: 'hr'; zone: number };

export interface WatchPlanStep {
  name?: string;
  notes?: string;
  intensity?: FitIntensity;
  /** time: segundos · distance: metros · open: até o atleta apertar volta. */
  duration: { type: 'time' | 'distance' | 'open'; value?: number };
  target: WatchPlanTarget | null;
}

/** Repete os passos desde `repeatFrom` (índice nesta lista) até este, `times` vezes no total. */
export interface WatchPlanRepeat {
  repeatFrom: number;
  times: number;
}

export interface WatchPlan {
  rev: string;
  name: string;
  steps: (WatchPlanStep | WatchPlanRepeat)[];
}

/** mm/s (unidade do FIT) → s/km. */
const secPerKm = (mmPerSec: number): number => Math.round(1_000_000 / mmPerSec);

function targetOf(step: FitWorkoutStep): WatchPlanTarget | null {
  if (
    step.targetType === 'speed' &&
    typeof step.customTargetValueLow === 'number' &&
    typeof step.customTargetValueHigh === 'number' &&
    step.customTargetValueLow > 0 &&
    step.customTargetValueHigh > 0
  ) {
    // No FIT `Low` é a velocidade menor, isto é, o pace mais lento.
    return {
      type: 'pace',
      fastSecPerKm: secPerKm(step.customTargetValueHigh),
      slowSecPerKm: secPerKm(step.customTargetValueLow),
    };
  }
  if (step.targetType === 'heartRate' && typeof step.targetValue === 'number') {
    return { type: 'hr', zone: step.targetValue };
  }
  return null;
}

function durationOf(step: FitWorkoutStep): WatchPlanStep['duration'] {
  if (step.durationType === 'time' && typeof step.durationValue === 'number') {
    return { type: 'time', value: Math.round(step.durationValue / 1000) };
  }
  if (step.durationType === 'distance' && typeof step.durationValue === 'number') {
    return { type: 'distance', value: Math.round(step.durationValue / 100) };
  }
  return { type: 'open' };
}

/**
 * Plano que o player do app no relógio executa, derivado dos mesmos passos do FIT: assim o treino
 * rodado no app Athly e o baixado para a lista nativa da Garmin são idênticos (nomes, faixas de
 * pace já alargadas, repetições).
 */
export function toWatchPlan(plan: FitWorkoutPlan): WatchPlan {
  return {
    rev: plan.rev,
    name: plan.name,
    steps: plan.steps.map((step): WatchPlanStep | WatchPlanRepeat => {
      if (step.durationType === 'repeatUntilStepsCmplt') {
        return { repeatFrom: step.durationValue ?? 0, times: step.targetValue ?? 1 };
      }
      return {
        ...(step.wktStepName ? { name: step.wktStepName } : {}),
        ...(step.notes ? { notes: step.notes } : {}),
        ...(step.intensity ? { intensity: step.intensity } : {}),
        duration: durationOf(step),
        target: targetOf(step),
      };
    }),
  };
}
