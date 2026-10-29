// Estrutura do objetivo do usuário armazenada em `UserGoal.parsedGoal` e consumida pelo
// AI planner. A interpretação em texto livre produz um rascunho separado; este contrato
// representa os objetivos confirmados e a integração de metas/viabilidade do planner.
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
