---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: weekly-goals

Gerenciar objetivos semanais (contém 7 Workouts cada).

## Propósito

CRUD de WeeklyGoal. Cada goal tem ~7 workouts gerados pela IA.

## Controller

`weekly-goals.controller.ts`

Endpoints:
- GET `/weekly-goals/training-plan/:trainingPlanId` — goals do plano
- GET `/weekly-goals/:uuid` — detalhe goal
- POST `/weekly-goals` — criar goal
- PUT `/weekly-goals/:uuid` — atualizar goal
- DELETE `/weekly-goals/:uuid` — deletar goal

## Services

- **WeeklyGoalsService**: CRUD, orquestração com AiPlannerService

## DTOs

- **CreateWeeklyGoalInput**: trainingPlanId, weekNumber, startDate
- **UpdateWeeklyGoalInput**: status (PLANNED, GENERATED, LOCKED, CANCELLED), metrics (JSON)
- **WeeklyGoalResponse**: id, weekNumber, startDate, status, workouts[], metrics

## Modelos envolvidos

- [[WeeklyGoal]] — objetivo semanal
- [[Workout]] — 7 workouts dentro do goal
- [[AiReasoning]] — reasoning da IA (geração)

## Fluxos

**GET /weekly-goals/training-plan/:trainingPlanId:**
1. Fetch TrainingPlan
2. Retorna array de WeeklyGoal com status
3. Cada goal inclui workouts[]

**POST /weekly-goals (com geração IA):**
1. Cliente POST CreateWeeklyGoalInput
2. WeeklyGoalsService cria WeeklyGoal (status = PLANNED)
3. Opcionalmente chama [[ai-planner|AiPlannerService]] para gerar workouts
4. AiPlannerService: fetch UserGoal + Assessment + Strava + EffortZones
5. Monta prompt, chama Gemini
6. Parse JSON → cria 7 Workouts
7. Persiste WeeklyGoal + Workouts + AiReasoning

**PUT /weekly-goals/:uuid:**
1. Atualiza status, metrics
2. Valida transições (PLANNED → LOCKED, etc.)

## Dependências

- Prisma — WeeklyGoal, Workout
- ai-planner — geração
- training-plans — referência

---

Ver: [[GET weekly-goals-training-plan]], [[POST weekly-goals]], [[AiPlannerService]]
