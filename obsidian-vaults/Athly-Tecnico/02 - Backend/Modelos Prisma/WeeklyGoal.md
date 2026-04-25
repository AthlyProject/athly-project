---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: WeeklyGoal

Objetivo semanal. Contém 7 Workouts (gerados por IA).

## Propósito

Agrupa 7 workouts coerentes para uma semana.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| uuid | UUID | false | PK |
| trainingPlanId | UUID | false | FK TrainingPlan |
| weekNumber | Int | false | semana 1-52 |
| startDate | DateTime | false | segunda-feira |
| status | WeeklyGoalStatus | false | PLANNED, GENERATED, etc. |
| metrics | JSON | true | { totalKm, avgPace, totalTime } |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- N:1 TrainingPlan
- 1:N Workout (7 por goal)
- 1:N AiReasoning (opcional)
- 1:N AiPlannerPromptLog (log da geração)

## Enums relacionados

- [[WeeklyGoalStatus]] — PLANNED, GENERATED, CANCELLED, LOCKED

## Usado em

- [[POST weekly-goals]] → cria goal + chama IA
- [[GET weekly-goals-training-plan]]
- [[Workout]] — parent

## Notas

- metrics: JSON com totalKm, avgPace, totalTime (calculado ao salvar)
- Status GENERATED: criado por IA
- Status LOCKED: usuário não pode modificar

---

Ver: [[Workout]], [[AiPlannerService]], [[_MOC Modelos]]
