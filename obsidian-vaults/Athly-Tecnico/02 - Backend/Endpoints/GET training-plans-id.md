---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /training-plans/:id
modulo: training-plans
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /training-plans/:id

Retorna detalhe de um plano de treino com weekly goals.

## Response 200

[[TrainingPlan]] com array de [[WeeklyGoal]].

---

Ver: [[training-plans]]
