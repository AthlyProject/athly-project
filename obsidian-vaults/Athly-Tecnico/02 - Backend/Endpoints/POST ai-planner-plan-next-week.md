---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /ai-planner/plan-next-week
modulo: ai-planner
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /ai-planner/plan-next-week

Gera plano para próxima semana via Gemini 2.5-flash.

## Autenticação

JwtAuthGuard (obrigatório).

## Request

```json
{
  "weekNumber": 1
}
```

## Response 201

```json
{
  "weeklyGoal": {
    "id": "uuid",
    "weekNumber": 1,
    "status": "GENERATED",
    "workouts": [7 Workouts]
  }
}
```

## Fluxo

1. Fetch UserGoal, Assessment, Strava runs, UserEffortZone
2. Mount [[Planner Prompt v3]]
3. Call [[GeminiService]]
4. Parse JSON → 7 Workouts
5. Persist WeeklyGoal + Workouts + AiReasoning + AiPlannerPromptLog
6. Retorna

---

Ver: [[ai-planner]], [[AiPlannerService]], [[Planner Prompt v3]]
