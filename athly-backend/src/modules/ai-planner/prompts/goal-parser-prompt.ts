// Estrutura do objetivo do usuário armazenada em `UserGoal.parsedGoal` e consumida pelo
// AI planner. A criação via texto livre foi removida; este tipo permanece como contrato
// dos objetivos já persistidos e da integração de metas/viabilidade do planner.
export interface ParsedGoal {
  isRunningRelated: boolean;
  targetDistance: string | null;
  targetTime: string | null;
  eventDate: string | null;
  eventName: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  summary: string;
  rejectionReason: string | null;
}
