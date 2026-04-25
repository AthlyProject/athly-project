---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /workouts/training-plan/:trainingPlanId
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /workouts/training-plan/:trainingPlanId

Retorna workouts de um plano de treino específico.

## Response 200

Array de [[Workout]] do plano.

---

Ver: [[workouts]], [[TrainingPlan]]
