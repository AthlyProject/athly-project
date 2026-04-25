---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /workouts/today
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /workouts/today

Retorna workouts agendados para hoje.

## Autenticação

JwtAuthGuard (obrigatório).

## Request

Query param (opcional):
```
?status=scheduled
```

## Response 200

```json
[
  {
    "id": "uuid",
    "dayOfWeek": 1,
    "sportType": "running",
    "status": "scheduled",
    "estimatedDurationMinutes": 45,
    "estimatedDistanceKm": 8,
    "blocks": {...},
    "description": "Tempo run"
  }
]
```

## Possíveis erros

| Código | Erro |
|--------|------|
| 401 | Não autenticado |

## DTOs relacionados

- [[Workout]]

## Fluxo interno

1. JwtAuthGuard
2. Get today's date (dayOfWeek)
3. Fetch Workouts where userId & dayOfWeek = today
4. Retorna array

---

Ver: [[workouts]], [[GET workouts-history]]
