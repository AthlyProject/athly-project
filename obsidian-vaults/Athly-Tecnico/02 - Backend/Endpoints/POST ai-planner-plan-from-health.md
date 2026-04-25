---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /ai-planner/plan-from-health
modulo: ai-planner
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /ai-planner/plan-from-health

Gera plano baseado em dados de saúde do iOS (HealthKit).

## Request

```json
{
  "healthData": {
    "recentRuns": 5,
    "averageDistance": 8,
    "averagePace": "5:45"
  }
}
```

## Response 201

[[WeeklyGoal]] com 7 Workouts.

---

Ver: [[ai-planner]], [[AiPlannerService]]
