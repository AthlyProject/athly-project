---
tags: [camada/backend, tipo/enum]
camada: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: TrainingPlanStatus

Estados de um plano de treino.

## Valores

| Valor | Descrição |
|-------|-----------|
| DRAFT | criado mas não ativo |
| ACTIVE | plano em execução |
| LOCKED | finalizado, não edita |
| COMPLETED | concluído (objetivo atingido?) |
| CANCELLED | cancelado |

## Transições válidas

```
DRAFT → ACTIVE
ACTIVE → LOCKED
LOCKED → COMPLETED
ACTIVE → CANCELLED
```

## Usado em

- [[TrainingPlan]] → status field

---

Ver: [[TrainingPlan]], [[_MOC Modelos]]
