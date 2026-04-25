---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 5 - AI Service"
prioridade: alta
---

# TASK-013 — AiModule e AiService

## Descrição

NestJS module e service para chamar IA (Claude/Gemini).

## Critérios de Aceite

- [ ] `ai.module.ts` criado com AiService
- [ ] AiService com método `generateWeeklyPlan(userId, workouts, preferences)`
- [ ] Prompt system bem estruturado
- [ ] Parsa response para JSON validation
- [ ] Error handling (timeout, API error, invalid JSON)
- [ ] Testes com mock IA response
- [ ] Importado em app.module

## Método Principal

```typescript
async generateWeeklyPlan(
  userId: string,
  workouts: Workout[],
  preferences: UserPreference
): Promise<TrainingPlan>
```

## Referências

- TASK-012
- [[Loop do MVP]]
