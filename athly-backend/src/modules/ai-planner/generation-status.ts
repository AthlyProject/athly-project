import { PlanGenerationStatus } from '@prisma/client';

export function serializeGenerationJob(job: {
  id: string;
  status: PlanGenerationStatus;
  error: string | null;
  weeklyGoalId: string | null;
  workoutIds: string[];
}) {
  const status = job.status.toLowerCase();
  const completed = job.status === PlanGenerationStatus.COMPLETED;
  const failed = job.status === PlanGenerationStatus.FAILED;

  return {
    generationId: job.id,
    status,
    pollAfterSeconds: 5,
    message: completed
      ? 'A semana foi gerada com sucesso.'
      : failed
        ? 'Não foi possível gerar a semana.'
        : 'A geração da semana está em andamento.',
    error: job.error ?? undefined,
    weeklyGoalId: job.weeklyGoalId ?? undefined,
    workoutIds: job.workoutIds,
  };
}
