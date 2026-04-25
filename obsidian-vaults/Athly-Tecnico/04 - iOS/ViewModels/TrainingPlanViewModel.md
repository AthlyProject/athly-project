---
tags: [tipo/viewmodel, camada/ios, dominio/treino]
tipo: viewmodel
camada: ios
arquivo: AthlyRunner/ViewModels/TrainingPlanViewModel.swift
status: implementado
created: 2026-04-24
---

# TrainingPlanViewModel

## Propósito
Carrega e expõe o plano de treino atual, a meta semanal vigente e os workouts da semana para as [[Plan Views]].

## Estado exposto
- `@Published var currentPlan: TrainingPlanDTO?`
- `@Published var currentWeeklyGoal: WeeklyGoalDTO?`
- `@Published var weekWorkouts: [WorkoutDTO]`
- `@Published var isLoading: Bool`
- `@Published var error: String?`

## Ações
- `loadAll() async`
- `refresh() async`
- `markWorkoutDone(id: UUID) async`
- `skipWorkout(id: UUID, reason: String) async`

## Dependências
- [[APIClient]]
- [[TrainingPlanCache]]
- [[APIModels]]

## Consumido por
- [[Plan Views]]

## Notas
- Usa cache em [[TrainingPlanCache]] para abrir offline
- Pull-to-refresh força bypass do cache
