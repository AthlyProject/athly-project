---
tags: [camada/frontend, tipo/documento]
camada: frontend
tipo: documento
status: implementado
created: 2026-04-24
---

# Store: useWorkoutStore

Workouts hoje + plano semanal em cache.

## State

```ts
{
  todayWorkouts: Workout[];
  currentPlan?: WeeklyGoal;
  isLoading: boolean;
}
```

## Ações

- `fetchToday()` → GET /workouts/today
- `fetchPlan(weeklyGoalId)` → GET /weekly-goals/:uuid
- `updateWorkoutStatus(id, status)` → PATCH /workouts/:id/complete

---

Ver: [[_MOC Frontend]]
