---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: goals

Gerenciar objetivos de usuário (maratona, 10k, triathlon, etc.).

## Propósito

CRUD de UserGoal. Cada goal alimenta AiPlannerService.

## Controller

`goals.controller.ts`

Endpoints:
- GET `/goals` — listar goals do usuário
- POST `/goals` — criar goal
- PUT `/goals/:id` — atualizar goal
- DELETE `/goals/:id` — deletar goal

## Services

- **GoalsService**: CRUD
- **GoalParserService**: valida se goal é running-related

## DTOs

- **CreateGoalInput**: title, description, targetDistance (km), targetTime (hh:mm), eventDate, eventName
- **GoalResponse**: id, title, targetDistance, targetTime, eventDate, status (active, completed)

## Modelos envolvidos

- [[UserGoal]] — objetivo do usuário
- Usado por [[AiPlannerService]]

## Fluxos

**POST /goals (validação):**
1. Cliente POST CreateGoalInput
2. GoalParserService.validateGoal(description)
3. Chama Gemini com goal-parser-prompt
4. Extrai: targetDistance, targetTime, eventDate, experienceLevel
5. Persiste em UserGoal
6. Retorna goal criado

**GET /goals:**
1. Fetch UserGoal where userId = user
2. Retorna array (pode ser vazio)

## Dependências

- Prisma — UserGoal
- [[GeminiService]] — parsing
- [[goal-parser-prompt|goal-parser-prompt.ts]]

---

Ver: [[UserGoal]], [[Goal Parser Prompt]], [[GET goals]], [[POST goals]]
