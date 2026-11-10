import type { DetailedSessionDto } from './dto/plan-from-health.dto';

export interface PersistedExecution {
  workoutId: string;
  appleHealthWorkoutUUID: string | null;
  executionDetails: unknown;
}

/**
 * Troca a sessão recém-lida do iPhone pela execução salva na conclusão do treino, quando as
 * duas descrevem a mesma corrida (mesmo UUID do HealthKit ou, sem UUID, o mesmo treino Athly).
 *
 * A versão salva foi segmentada com a prescrição e é a que o atleta viu e confirmou. A releitura
 * do sync pode sair diferente: corrida de outro app/relógio sem a prescrição cai na heurística de
 * laps, e um aquecimento + 2,5 km de limiar + volta à calma virava "rec, rec, rep, rep". A
 * geração semanal (PlannerHealthContextService.generationInput) já dava preferência à versão
 * salva; este helper alinha a geração manual ao mesmo critério.
 */
export function preferPersistedExecutions(
  sessions: DetailedSessionDto[],
  persisted: PersistedExecution[],
): DetailedSessionDto[] {
  const byUuid = new Map<string, DetailedSessionDto>();
  const byWorkoutId = new Map<string, DetailedSessionDto>();
  for (const entry of persisted) {
    const detail = validExecutionDetail(entry.executionDetails);
    if (!detail) continue;
    const session = { ...detail, athlyWorkoutId: entry.workoutId };
    const uuid = (detail.appleHealthWorkoutUUID ?? entry.appleHealthWorkoutUUID)?.toLowerCase();
    if (uuid) byUuid.set(uuid, session);
    byWorkoutId.set(entry.workoutId, session);
  }

  return sessions.map((session) => {
    const uuid = session.appleHealthWorkoutUUID?.toLowerCase();
    if (uuid) return byUuid.get(uuid) ?? session;
    return (session.athlyWorkoutId && byWorkoutId.get(session.athlyWorkoutId)) || session;
  });
}

function validExecutionDetail(raw: unknown): DetailedSessionDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<DetailedSessionDto>;
  if (
    typeof value.startDate !== 'string' ||
    typeof value.distanceMeters !== 'number' ||
    typeof value.durationSeconds !== 'number' ||
    !Array.isArray(value.segments)
  ) {
    return null;
  }
  return value as DetailedSessionDto;
}
