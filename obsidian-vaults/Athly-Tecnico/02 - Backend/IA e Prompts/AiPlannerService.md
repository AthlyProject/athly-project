---
tags: [camada/backend, tipo/servico]
camada: backend
tipo: servico
status: implementado
created: 2026-04-24
---

# Serviço: AiPlannerService

Orquestração de geração de planos semanais via Gemini.

## Propósito

Coordenar coleta de dados do usuário (goal, assessment, histórico, zonas) e gerar 7 workouts otimizados.

## Método principal

```ts
async planNextWeek(userId: string, options?: {
  weekNumber?: number;
  overrideGoal?: UserGoal;
}): Promise<WeeklyGoalWithWorkouts>
```

## Fluxo detalhado

1. **Fetch dados**:
   - [[UserGoal]] (target, deadline)
   - [[Assessment]] (experience level, zones)
   - Strava runs (últimas 4 semanas)
   - [[UserEffortZone]] (custom thresholds)
   - Previous week analysis

2. **Mount prompt**:
   - User profile (age, fitness level, goals)
   - Assessment data
   - Historical performance
   - Target for week
   - Constraint

3. **Call Gemini**:
   - [[GeminiService]].generatePlan(prompt)
   - Model: gemini-2.5-flash

4. **Parse response**:
   - JSON validation
   - 7 workouts extraction
   - Type validation

5. **Persist**:
   - Create [[WeeklyGoal]] (status = GENERATED)
   - Create 7 [[Workout]]
   - Create [[AiReasoning]] (decision logic)
   - Log em [[AiPlannerPromptLog]]

## Dependências

- [[GeminiService]]
- [[strava|StravaService]]
- Prisma (User, UserGoal, Assessment, Workout, etc.)

---

Ver: [[ai-planner]], [[POST ai-planner-plan-next-week]], [[Planner Prompt v3]]
