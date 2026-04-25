---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PUT
path: /weekly-goals/:uuid
modulo: weekly-goals
auth_required: true
status: implementado
created: 2026-04-24
---

# PUT /weekly-goals/:uuid

Atualiza weekly goal (status, metrics).

## Request

```json
{
  "status": "LOCKED",
  "metrics": { "totalKm": 45, "avgPace": "5:45" }
}
```

## Response 200

[[WeeklyGoal]] atualizado.

---

Ver: [[weekly-goals]]
