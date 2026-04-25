---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PUT
path: /training-plans/:id
modulo: training-plans
auth_required: true
status: implementado
created: 2026-04-24
---

# PUT /training-plans/:id

Atualiza plano de treino.

## Request

```json
{
  "status": "ACTIVE",
  "endDate": "2026-07-15"
}
```

## Response 200

[[TrainingPlan]] atualizado.

---

Ver: [[training-plans]]
