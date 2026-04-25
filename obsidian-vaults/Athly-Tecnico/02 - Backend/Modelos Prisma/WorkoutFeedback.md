---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: WorkoutFeedback

Feedback pós-workout (rating, notas, métricas reais).

## Propósito

Capturar percepção do usuário e métricas reais (vs. estimado).

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| workoutId | UUID | false | FK Workout |
| rating | Int | true | 1-10 (how was it?) |
| notes | String | true | feedback livre |
| actualDurationMinutes | Int | true | duração real |
| actualDistanceKm | Float | true | distância real |
| perceivedEffort | Int | true | 1-10 RPE |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 Workout

## Usado em

- [[POST workouts-id-feedback]] → submeter feedback
- Análise: feedback informará ajustes futuros

## Notas

- Feedback opcional (alguns workouts podem não ter)
- Comparação estimado vs. real ajuda calibrar IA
- Rating + perceivedEffort informam satisfação

---

Ver: [[Workout]], [[_MOC Modelos]]
