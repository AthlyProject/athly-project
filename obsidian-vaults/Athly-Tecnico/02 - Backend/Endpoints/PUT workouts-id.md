---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PUT
path: /workouts/:id
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# PUT /workouts/:id

Atualiza workout existente.

## Request

```json
{
  "status": "scheduled",
  "estimatedDurationMinutes": 50,
  "blocks": {...}
}
```

## Response 200

Retorna [[Workout]] atualizado.

---

Ver: [[workouts]]
