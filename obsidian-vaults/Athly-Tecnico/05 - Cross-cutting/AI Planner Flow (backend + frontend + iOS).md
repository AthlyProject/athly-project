---
tags: [camada/cross, tipo/fluxo]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# AI Planner Flow: Backend + Frontend + iOS

Geração de plano semanal multi-camada.

## 1. User trigger

Frontend/iOS: clica "Generate plan for next week"

## 2. Backend orquestra

```
POST /ai-planner/plan-next-week

AiPlannerService.planNextWeek(userId):
  1. Fetch UserGoal (próxima meta)
  2. Fetch Assessment (zonas, experience)
  3. Fetch Strava runs (últimas 4 semanas)
  4. Fetch UserEffortZone (custom thresholds)
  5. Análise semana anterior
  6. Mount Planner Prompt v3.0
  7. GeminiService.generatePlan(prompt)
  8. Parse JSON → 7 Workouts
  9. Persist WeeklyGoal + Workouts + AiReasoning + AiPlannerPromptLog
  10. Retorna WeeklyGoal
```

## 3. Response

```json
{
  "weeklyGoal": {
    "id": "uuid",
    "weekNumber": 1,
    "workouts": [7 Workout objects],
    "status": "GENERATED"
  }
}
```

## 4. Frontend/iOS exibe

Mostra 7 workouts para semana.

## 5. Durante execução

iOS + Frontend sincronizam:
- GPS tracking (iOS)
- Pace, distance real-time (iOS)
- Feedback pós-workout (Frontend/iOS)

---

Ver: [[Fluxos cross-cutting]], [[ai-planner]], [[AiPlannerService]]
