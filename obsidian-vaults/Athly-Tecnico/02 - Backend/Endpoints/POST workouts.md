---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /workouts
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /workouts

Cria novo workout manualmente.

## Request

```json
{
  "weeklyGoalId": "uuid",
  "sportType": "running",
  "estimatedDurationMinutes": 45,
  "estimatedDistanceKm": 8,
  "description": "Easy run"
}
```

## Response 201

Retorna [[Workout]] criado.

---

Ver: [[workouts]], [[WeeklyGoal]]
