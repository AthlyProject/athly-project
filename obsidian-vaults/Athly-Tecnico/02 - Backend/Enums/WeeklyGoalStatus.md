---
tags: [camada/backend, tipo/enum]
camala: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: WeeklyGoalStatus

Estados de um objetivo semanal.

## Valores

| Valor | Descrição |
|-------|-----------|
| PLANNED | ainda não gerado pela IA |
| GENERATED | IA gerou os 7 workouts |
| LOCKED | usuário finalizou semana, sem mais edits |
| CANCELLED | semana cancelada |

## Transições válidas

```
PLANNED → GENERATED
GENERATED → LOCKED
GENERATED → CANCELLED
```

## Usado em

- [[WeeklyGoal]] → status field
- UI: quando mostrar "gerar plano" vs "view plano"

---

Ver: [[WeeklyGoal]], [[AiPlannerService]], [[_MOC Modelos]]
