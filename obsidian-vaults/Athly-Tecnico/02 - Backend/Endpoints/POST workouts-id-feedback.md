---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /workouts/:id/feedback
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /workouts/:id/feedback

Submete feedback pós-workout.

## Request

```json
{
  "rating": 8,
  "notes": "Felt strong, could do more",
  "actualDistanceKm": 8.5,
  "actualDurationMinutes": 43,
  "perceivedEffort": 7
}
```

## Response 201

Retorna [[WorkoutFeedback]] criado.

## Fluxo

1. Cria WorkoutFeedback
2. Opcionalmente gera AiReasoning (insights)
3. Marca Workout como done

---

Ver: [[workouts]], [[WorkoutFeedback]], [[AiReasoning]]
