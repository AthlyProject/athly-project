---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: TrainingPlan

Período de treino (ex: "Maratona 2026", "10k em 6 semanas").

## Propósito

Agrupa múltiplas WeeklyGoal em um programa coerente.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| name | String | false | "Maratona 2026" |
| description | String | true | notas gerais |
| sportType | SportType | false | running, cycling, etc. |
| status | TrainingPlanStatus | false | ACTIVE, COMPLETED, etc. |
| startDate | DateTime | false | início |
| endDate | DateTime | false | previsto |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- N:1 User
- 1:N WeeklyGoal

## Enums relacionados

- [[SportType]]
- [[TrainingPlanStatus]] — ACTIVE, COMPLETED, CANCELLED, LOCKED, DRAFT

## Usado em

- [[POST training-plans]]
- [[GET training-plans-me]]
- [[WeeklyGoal]] — parent

## Notas

- Status LOCKED: não permite edit (ou apenas admin)
- Relatórios agregam por plan (total km, volume)

---

Ver: [[WeeklyGoal]], [[_MOC Modelos]]
