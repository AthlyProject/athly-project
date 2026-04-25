---
tags: [camada/backend, tipo/enum]
camada: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: WorkoutStatus

Estados de um workout individual.

## Valores

| Valor | Descrição |
|-------|-----------|
| scheduled | planejado, não iniciado |
| done | completado com sucesso |
| skipped | pulado (rest day) |
| partial | parcialmente completado |

## Transições válidas

```
scheduled → done
scheduled → skipped
scheduled → partial
partial → done (reattempt?)
```

## Usado em

- [[Workout]] → status field
- [[PATCH workouts-id-complete]] → transição
- [[PATCH workouts-id-skip]]

---

Ver: [[Workout]], [[_MOC Modelos]]
