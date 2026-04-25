---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: UserEffortZone

Zonas de esforço customizadas do usuário (HR, pace, RPE).

## Propósito

Armazenar threshold de esforço para IA calibrar workouts.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| name | String | false | "Z1", "Aerobic", "Threshold" |
| minHeartRate | Int | true | bpm mínima |
| maxHeartRate | Int | true | bpm máxima |
| minPace | Float | true | min/km mínimo (para running) |
| maxPace | Float | true | min/km máximo |
| minRPE | Int | true | RPE mínima (1-10) |
| maxRPE | Int | true | RPE máxima |
| source | String | true | "strava_import", "manual", etc. |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User

## Usado em

- [[POST effort-zones]] (manual ou import Strava)
- [[AiPlannerService]] → calibra intensidades

## Notas

- Zonas importadas de Strava ou criadas manualmente
- IA usa para gerar blocks com intensidades adequadas

---

Ver: [[effort-zones]], [[User]], [[AiPlannerService]], [[_MOC Modelos]]
