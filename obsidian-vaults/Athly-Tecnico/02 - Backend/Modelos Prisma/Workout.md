---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: Workout

Treino individual (1 dia, ~1h, 10km, etc.).

## Propósito

Representa um workout executável. Estrutura em JSON blocks para flexibilidade.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| weeklyGoalId | UUID | false | FK WeeklyGoal |
| dayOfWeek | Int | false | 0-6 (Monday-Sunday) |
| sportType | SportType | false | running, cycling, etc. |
| status | WorkoutStatus | false | scheduled, done, skipped, partial |
| estimatedDurationMinutes | Int | true | duração prevista |
| estimatedDistanceKm | Float | true | distância prevista |
| blocks | JSON | true | estrutura de intensidades (warm-up, main, cooldown) |
| description | String | true | instruções livres |
| completedAt | DateTime | true | quando terminou |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- N:1 WeeklyGoal
- 1:N WorkoutFeedback

## Enums relacionados

- [[SportType]]
- [[WorkoutStatus]] — scheduled, done, skipped, partial

## Usado em

- [[POST workouts]] → criação manual
- [[GET workouts-today]]
- [[WorkoutFeedback]] → feedback

## Notas

- **blocks JSON**: exemplo:
  ```json
  {
    "warmUp": { "duration_min": 10, "type": "easy" },
    "main": { "duration_min": 35, "type": "tempo", "distance_km": 7 },
    "coolDown": { "duration_min": 5, "type": "easy" }
  }
  ```
- Flexibilidade: IA gera workouts com estrutura, usuário pode customizar
- Status transitions: scheduled → done | skipped | partial

---

Ver: [[WorkoutFeedback]], [[WeeklyGoal]], [[_MOC Modelos]]
