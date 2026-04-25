---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: AiReasoning

Armazena lógica de decisão da IA (raciocínio por trás de recomendações).

## Propósito

Audit trail + explicabilidade: por que IA gerou este workout/plano?

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| relatedTo | String | false | "workout_feedback", "weekly_goal_generation" |
| relatedId | UUID | false | FK (workoutId ou weeklyGoalId) |
| reasoning | String | false | JSON ou texto livre (explicação) |
| confidence | Float | true | 0-1 (quanto a IA confia) |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User
- Referências polimórficas (workoutId ou weeklyGoalId)

## Usado em

- [[POST ai-planner-plan-next-week]] → cria AiReasoning
- [[POST workouts-id-feedback]] → análise de feedback
- Feedback do usuário: "por que este workout?"

## reasoning JSON

```json
{
  "decision": "generated_high_intensity_session",
  "factors": {
    "user_feedback": "rated last workout 8/10, felt strong",
    "strava_data": "recent pace improvement trend",
    "zones": "can push closer to threshold",
    "goal": "building towards 10k event"
  },
  "recommendation": "introduce tempo run"
}
```

## Notas

- Persiste em JSON para máxima flexibilidade
- Rastreabilidade: usuário vê "por que?" em UI

---

Ver: [[AiPlannerService]], [[WeeklyGoal]], [[Workout]], [[_MOC Modelos]]
