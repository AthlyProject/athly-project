---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: Assessment

Avaliação inicial de novo atleta. 5 sessões RPE-based.

## Propósito

Capturar baseline fitness + preferências para calibrar IA.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| answers | JSON | false | respostas estruturadas das 5 sessões |
| experienceLevel | String | true | "beginner", "intermediate", "advanced" (parsed) |
| completedAt | DateTime | false | when submitted |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User

## Usado em

- [[POST assessment]] → submete assessment
- [[GET assessment]] → status do assessment
- [[AiPlannerService]] → input para geração

## answers JSON

```json
{
  "session_1": {
    "years_running": 3,
    "goal": "complete 10k"
  },
  "session_2": {
    "comfortable_distance_km": 5,
    "avg_pace": "6:00 min/km"
  },
  "session_3": {
    "easy_rpe": 3,
    "threshold_rpe": 7
  },
  "session_4": {
    "injuries": [],
    "restrictions": ""
  },
  "session_5": {
    "preferred_time": "morning",
    "preferred_days": ["monday", "wednesday", "saturday"]
  }
}
```

## Notas

- Realizado na first login
- Gate: User.assessmentCompleted = true
- Não pode ser editado (readonly após submit)

---

Ver: [[assessment]], [[User]], [[_MOC Modelos]]
