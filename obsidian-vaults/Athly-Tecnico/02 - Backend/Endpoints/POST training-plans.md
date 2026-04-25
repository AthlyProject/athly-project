---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /training-plans
modulo: training-plans
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /training-plans

Cria novo plano de treino.

## Request

```json
{
  "name": "Maratona 2026",
  "sportType": "running",
  "startDate": "2026-05-01",
  "endDate": "2026-06-30",
  "goal": "Complete marathon under 3:45"
}
```

## Response 201

[[TrainingPlan]] criado.

---

Ver: [[training-plans]]
