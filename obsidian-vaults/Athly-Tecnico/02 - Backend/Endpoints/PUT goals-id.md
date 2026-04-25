---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PUT
path: /goals/:id
modulo: goals
auth_required: true
status: implementado
created: 2026-04-24
---

# PUT /goals/:id

Atualiza objetivo.

## Request

```json
{
  "status": "completed"
}
```

## Response 200

[[UserGoal]] atualizado.

---

Ver: [[goals]]
