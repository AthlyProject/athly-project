import { ENGINE_VERSION, instant, requireInput, stableHash } from './core';
import type { Instant } from './core';
import type { Prescription } from './types';
import { evaluateGoal } from './objective';
import type { GoalTarget, NormalizedRun, ObjectiveEvaluation } from './objective';
import { createPrescription } from './prescription';
import type { PrescriptionInput, PrescriptionResult } from './prescription';

export type EvaluationEvidence = Pick<
  NormalizedRun,
  | 'id'
  | 'provenance'
  | 'measurementSource'
  | 'sourceBundleIdentifier'
  | 'userEntered'
  | 'activityKind'
  | 'distanceBasis'
  | 'continuity'
  | 'endDate'
  | 'distanceMeters'
  | 'elapsedSeconds'
> & { source: string; startDate: Instant };
export type Evaluation = ObjectiveEvaluation & {
  prescription: Prescription;
  evidence: EvaluationEvidence[];
};

/** Complete evaluation facade, while keeping goal evidence and prescription context independent. */
export function evaluateFeasibility(input: {
  evaluationId: string;
  goalId: string;
  goalVersion: number;
  preferencesHash: string;
  prescriptionInput: PrescriptionInput;
}): PrescriptionResult & { evaluation: Evaluation } {
  const result = createPrescription(input.prescriptionInput);
  const objective = input.prescriptionInput.objective;
  const evaluation: Evaluation = {
    ...evaluateGoal({
      id: input.evaluationId,
      goalId: input.goalId,
      goalVersion: input.goalVersion,
      preferencesHash: input.preferencesHash,
      target: input.prescriptionInput.target,
      evidence: objective,
    }),
    prescription: result.prescription,
    evidence: objective.runs
      .filter((r): r is NormalizedRun & { startDate: Instant } => r.startDate !== null)
      .map((r) => ({
        id: r.id,
        source: r.sourceId ?? r.id,
        provenance: r.provenance,
        measurementSource: r.measurementSource,
        sourceBundleIdentifier: r.sourceBundleIdentifier,
        userEntered: r.userEntered,
        activityKind: r.activityKind,
        distanceBasis: r.distanceBasis,
        continuity: r.continuity,
        startDate: r.startDate,
        endDate: r.endDate,
        distanceMeters: r.distanceMeters,
        elapsedSeconds: r.elapsedSeconds,
      })),
  };
  return { ...result, evaluation };
}

/** Pure acceptance preconditions. The future adapter must read and enforce these under its lock. */
export function checkEvaluationPreconditions(input: {
  userId: string;
  evaluationOwnerId: string;
  evaluation: ObjectiveEvaluation;
  at: Instant;
  goalId: string;
  goalVersion: number;
  currentTarget: GoalTarget;
  evidenceHash: string;
  preferencesHash: string;
  engineVersion: string;
}): void {
  const e = input.evaluation;
  requireInput(input.userId === input.evaluationOwnerId, 'EVALUATION_NOT_FOUND');
  requireInput(
    e.goalId === input.goalId &&
      e.goalVersion === input.goalVersion &&
      stableHash(e.target) === stableHash(input.currentTarget),
    'GOAL_VERSION_CHANGED',
  );
  requireInput(
    e.engineVersion === input.engineVersion && input.engineVersion === ENGINE_VERSION,
    'ENGINE_CHANGED',
  );
  requireInput(
    instant(input.at) >= instant(e.asOf) && instant(input.at) < instant(e.expiresAt),
    'EVALUATION_EXPIRED',
  );
  requireInput(e.evidenceHash === input.evidenceHash, 'EVIDENCE_CHANGED');
  requireInput(e.preferencesHash === input.preferencesHash, 'PREFERENCES_CHANGED');
}
