---
tags: [tipo/servico, camada/ios, dominio/treino]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/TrainingPlanCache.swift
status: implementado
created: 2026-04-24
---

# TrainingPlanCache

## Propósito
Cacheia o plano de treino atual e workouts da semana para permitir visualização offline e evitar refetch a cada abertura da [[Plan Views]].

## API pública
- `savePlan(_ plan: TrainingPlanDTO)`
- `loadPlan() -> TrainingPlanDTO?`
- `saveWorkouts(_ workouts: [WorkoutDTO], for weekGoalId: UUID)`
- `loadWorkouts(for weekGoalId: UUID) -> [WorkoutDTO]?`
- `invalidate()`

## Armazenamento
- JSON em `Library/Caches/`
- TTL configurável (default: 1h)

## Dependências
- `FileManager`
- `JSONEncoder/Decoder`

## Consumido por
- [[TrainingPlanViewModel]]

## Notas
- Distinto de [[RunStore]] (que é Documents/ e permanente)
- Ao logout do [[AuthViewModel]] → chama `invalidate()`
