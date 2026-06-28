import type { LongitudinalWeek } from '../ai-planner/prompts/planner-prompt';
import type { PreviousWeekAnalysis } from '../ai-planner/types/planner.types';
import type { GoalFeasibility } from '../ai-planner/goal-feasibility';

/**
 * Laudo do plano deletado — captura a essência das últimas (até 4) semanas para
 * brifar a IA na criação do próximo plano, sobrevivendo ao cascade do delete.
 */
export interface TrainingReport {
  sourcePlanId: string;
  objective: string;
  targetDate: string | null;
  longitudinalWeeks: LongitudinalWeek[];
  previousWeekAnalysis: PreviousWeekAnalysis | null;
  finalInsights: { fitnessInsights: string | null; trend: string | null } | null;
  feasibility: GoalFeasibility | null;
  generatedAt: string;
}
