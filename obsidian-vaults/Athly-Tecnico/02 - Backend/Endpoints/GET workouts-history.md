---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /workouts/history
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /workouts/history

Retorna histórico de workouts do usuário (paginado).

## Autenticação

JwtAuthGuard (obrigatório).

## Query params

```
?page=1&limit=20&status=done
```

## Response 200

```json
{
  "data": [Workout[]],
  "pagination": { "page": 1, "limit": 20, "total": 45 }
}
```

---

Ver: [[workouts]], [[GET workouts-today]]
