---
tags: [tipo/view, camada/ios, dominio/treino]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Plan Views

## Propósito
Telas que mostram o plano de treino atual, a semana vigente e o detalhe de cada [[Workout]].

## Views incluídas
- `PlanOverviewView` (header com plano + meta semanal)
- `WeekView` (lista de workouts da semana)
- `WorkoutDetailView` (detalhe completo de um workout)

## ViewModel
- [[TrainingPlanViewModel]]

## Dependências
- [[WorkoutDetailFetcher]] (para detalhe)
- [[TrainingPlanCache]] (offline)
- [[Components reutilizáveis]] (WorkoutCard, ZoneBadge)

## Ações possíveis em WorkoutDetailView
- Marcar done
- Skip com motivo
- Iniciar corrida (pula para [[Run Views]] com workoutId pré-vinculado)
- Ver raciocínio da IA (sheet)

## Notas
- Pull-to-refresh em `WeekView`
- Badge de origem (Strava/IA/Manual) quando aplicável
