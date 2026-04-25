---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /weekly-goals/training-plan/:trainingPlanId
modulo: weekly-goals
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /weekly-goals/training-plan/:trainingPlanId

Retorna weekly goals de um plano de treino.

## Response 200

Array de [[WeeklyGoal]] com workouts.

---

Ver: [[weekly-goals]]
