---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: workouts

Gerenciar workouts, feedback, status (done/skipped/partial).

## Propósito

CRUD completo de Workout (listar, detalhar, atualizar status, coletar feedback).

## Controller

`workouts.controller.ts`

Endpoints:
- GET `/workouts/today` — workouts de hoje
- GET `/workouts/:id` — detalhe workout
- GET `/workouts/history` — histórico (paginado)
- GET `/workouts/training-plan/:trainingPlanId` — workouts do plano
- POST `/workouts` — criar workout
- PUT `/workouts/:id` — atualizar workout
- POST `/workouts/:id/feedback` — coletar feedback (rating, notes, actualKm)
- PATCH `/workouts/:id/complete` — marcar como done
- PATCH `/workouts/:id/skip` — marcar como skipped

## Services

- **WorkoutsService**: CRUD, status transitions, feedback
- **WorkoutFeedbackService**: análise pós-workout

## DTOs

- **CreateWorkoutInput**: weeklyGoalId, sportType, blocks (JSON), estimatedDurationMinutes
- **UpdateWorkoutInput**: status, blocks
- **WorkoutFeedbackInput**: rating (1-10), notes, actualKm, actualDurationMinutes, perceived_effort
- **WorkoutResponse**: id, status, blocks, feedback (se existir)

## Modelos envolvidos

- [[Workout]] — treino
- [[WorkoutFeedback]] — feedback
- [[WeeklyGoal]] — referência
- [[AiReasoning]] — análise IA (opcional)

## Fluxos

**GET /workouts/today:**
1. JwtAuthGuard extrai userId
2. WorkoutsService.getTodayWorkouts(userId)
3. Retorna array de Workouts para hoje

**POST /workouts/:id/feedback:**
1. Usuário termina workout
2. POST feedback (rating, notes, actualKm)
3. WorkoutFeedbackService analisa (volume, intensity)
4. Persiste WorkoutFeedback
5. Opcionalmente gera AiReasoning (insights)

**PATCH /workouts/:id/complete:**
1. Atualiza status = "done"
2. Timestamp completedAt

## Dependências

- Prisma — Workout, WorkoutFeedback
- weekly-goals — referência
- ai-planner — para reasoning (opcional)

---

Ver: [[GET workouts-today]], [[POST workouts]], [[POST workouts-id-feedback]]
