---
tags: [tipo/servico, camada/frontend, dominio/treino]
tipo: servico
camada: frontend
arquivo: src/services/workoutService.ts
status: implementado
created: 2026-04-24
---

# workoutService

## Propósito
Fachada de alto nível para operações de treino. Agrupa chamadas do [[ApiManager]] em funções semânticas e mapeia respostas para o shape que os componentes esperam (ex: agrupar workouts por `weeklyGoal` em "weeks").

## API pública

| Método | Retorno | Endpoint |
|--------|---------|----------|
| `getTodayWorkout()` | `Workout \| null` | [[GET workouts-today]] |
| `getWorkoutById(id)` | `Workout \| null` | [[GET workouts-id]] |
| `getCurrentTrainingPlan()` | `TrainingPlan \| null` (com weeks agrupadas) | [[GET training-plans-me]] |
| `getCalendarData()` | `{ weeklyGoals, workouts }` | [[GET weekly-goals-training-plan]] |
| `submitWorkoutFeedback(input)` | — | [[POST workouts-id-feedback]] |
| `updateWorkout(id, input)` | — | [[PUT workouts-id]] |
| `createWorkout(input)` | — | [[POST workouts]] |

## Consumido por
- [[DashboardPage]] via [[useWorkoutData]]
- [[WorkoutPage]], [[FeedbackPage]], [[PlanPage]], [[TrainingPlanCalendarPage]]

## Tratamento de erros
- try/catch envolve cada chamada
- `console.error` loga
- Retorna `null` ou array vazio como fallback seguro
- Toasts são disparados pelos componentes, não aqui

## Notas
- Faz pós-processamento: agrupa workouts por weeklyGoal para "semanas"
