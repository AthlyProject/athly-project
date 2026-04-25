---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: training-plans

Gerenciar planos de treino (períodos, status).

## Propósito

CRUD de TrainingPlan (período de treino, contém múltiplas WeeklyGoals).

## Controller

`training-plans.controller.ts`

Endpoints:
- GET `/training-plans/me` — listar plans do usuário
- GET `/training-plans/:id` — detalhe plan
- POST `/training-plans` — criar plan
- PUT `/training-plans/:id` — atualizar plan
- DELETE `/training-plans/:id` — deletar plan

## Services

- **TrainingPlansService**: CRUD, validações de período

## DTOs

- **CreateTrainingPlanInput**: name, startDate, endDate, sportType, goal (description)
- **UpdateTrainingPlanInput**: name, endDate, status
- **TrainingPlanResponse**: id, name, startDate, endDate, status (ACTIVE, COMPLETED, etc.), weeklyGoals[]

## Modelos envolvidos

- [[TrainingPlan]] — plano
- [[WeeklyGoal]] — objetivos semanais dentro do plano

## Fluxos

**GET /training-plans/me:**
1. JwtAuthGuard extrai userId
2. TrainingPlansService.getUserPlans(userId)
3. Retorna array com TrainingPlan + weeklyGoals

**POST /training-plans:**
1. Cliente POST com CreateTrainingPlanInput
2. Valida startDate < endDate
3. Cria TrainingPlan (status = DRAFT)
4. Retorna plano criado

**PUT /training-plans/:id:**
1. Atualiza fields (name, endDate, status)
2. Valida status transitions

## Dependências

- Prisma — TrainingPlan, WeeklyGoal
- weekly-goals — relação

---

Ver: [[GET training-plans-me]], [[POST training-plans]]
