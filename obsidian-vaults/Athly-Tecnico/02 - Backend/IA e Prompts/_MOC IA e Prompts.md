---
tags: [camada/backend, tipo/moc]
camada: backend
tipo: moc
status: implementado
created: 2026-04-24
---

# IA e Prompts — MOC

GeminiService, AiPlannerService, e 3 prompts principais.

## Serviços

- [[GeminiService]] — wrapper @google/generative-ai
- [[AiPlannerService]] — orquestração (coleta dados → prompt → parse)

## Prompts

- [[Planner Prompt v3]] — gera 7 workouts semanais
- [[Goal Parser Prompt]] — extrai target metrics de objective
- [[Assessment Prompt]] — analisa responses de assessment (5 sessões)

## Flow

[[AiPlannerService]] orquestra:
1. Fetch UserGoal, Assessment, Strava, EffortZones
2. Mount [[Planner Prompt v3]]
3. [[GeminiService]].generatePlan()
4. Parse JSON → 7 Workouts
5. Persist + log em [[AiPlannerPromptLog]]

---

Ver: [[ai-planner]], [[goals]], [[assessment]]
