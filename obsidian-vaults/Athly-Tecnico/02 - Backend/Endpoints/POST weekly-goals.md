---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /weekly-goals
modulo: weekly-goals
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /weekly-goals

Cria novo weekly goal (com opção de gerar via IA).

## Request

```json
{
  "trainingPlanId": "uuid",
  "weekNumber": 1,
  "startDate": "2026-05-01",
  "generateWithAI": true
}
```

## Response 201

[[WeeklyGoal]] com 7 [[Workout]] (se gerado com IA).

---

Ver: [[weekly-goals]], [[AiPlannerService]]
