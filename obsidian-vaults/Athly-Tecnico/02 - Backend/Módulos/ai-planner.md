---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: ai-planner

Orquestração de geração de planos via Gemini 2.5-flash.

## Propósito

Serviço central que coordena coleta de dados e chamada à IA para gerar planos semanais.

## Controller

`ai-planner.controller.ts`

Endpoints:
- POST `/ai-planner/plan-next-week` — gera plano para próxima semana
- POST `/ai-planner/plan-from-health` — gera plano baseado em HealthKit (iOS)

## Services

- **AiPlannerService**: orquestração principal
  1. Fetch UserGoal (target distance, time, event)
  2. Fetch Assessment (zones, experienceLevel)
  3. Fetch Strava (últimas runs)
  4. Fetch UserEffortZone (zonas customizadas)
  5. Análise semana anterior
  6. Mount prompt v3.0
  7. Call Gemini 2.5-flash
  8. Parse JSON response
  9. Persist WeeklyGoal + 7 Workouts + AiReasoning + AiPlannerPromptLog

## DTOs

- **PlanNextWeekInput**: (vazio ou com overrides)
- **PlanFromHealthInput**: healthData (JSONreserved dari iOS)
- **PlanResponse**: weeklyGoal { id, workouts[] }

## Modelos envolvidos

- [[WeeklyGoal]] — criado
- [[Workout]] — 7 criados
- [[AiReasoning]] — lógica por trás
- [[AiPlannerPromptLog]] — auditoria (prompt + raw response)
- [[UserGoal]], [[Assessment]], [[UserEffortZone]] — inputs

## Fluxos

**POST /ai-planner/plan-next-week:**

1. JwtAuthGuard extrai userId
2. AiPlannerService.planNextWeek(userId)
3. Fetch UserGoal (corrida para semana X)
4. Fetch Assessment (experienceLevel, effort zones)
5. Fetch Strava runs últimas 4 semanas
6. Fetch UserEffortZone customizadas
7. Mount [[Planner Prompt v3|prompt v3.0]]
   - User profile (age, weight, goals)
   - Assessment (zones, experience)
   - Historical performance
   - Target for week
8. GeminiService.generatePlan(prompt)
9. Parse JSON: { workouts: [ { day, type, duration, intensity, description, blocks } ] }
10. Valida (7 workouts, types válidos)
11. Cria WeeklyGoal (status = GENERATED)
12. Cria 7 Workouts associados
13. Cria AiReasoning (estrutura de decisão)
14. Log completo em AiPlannerPromptLog (prompt sent + raw response + tokens used)
15. Retorna WeeklyGoal + workouts

## Dependências

- [[GeminiService]] — chamada IA
- strava — histórico
- [[_MOC Modelos|Modelos Prisma]]
- [[_MOC IA e Prompts|Prompts]]

---

Ver: [[AiPlannerService]], [[Planner Prompt v3]], [[POST ai-planner-plan-next-week]]
