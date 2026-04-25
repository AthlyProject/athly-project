---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 3 - Strava Sync Service"
prioridade: alta
---

# TASK-007 — Criar StravaModule

## Descrição

NestJS module e service para sincronizar com Strava API.

## Critérios de Aceite

- [ ] `strava.module.ts` criado com StravaService
- [ ] StravaService com método `syncActivities(userId)`
- [ ] HTTP client configurado (axios ou fetch)
- [ ] Error handling para API errors
- [ ] Testes unitários com mocks
- [ ] Importado em app.module

## Métodos Principais

```typescript
export class StravaService {
  async syncActivities(userId: string): Promise<Workout[]>
  async refreshToken(userId: string): Promise<void>
  async getActivities(accessToken: string, after: number): Promise<any[]>
}
```

## Referências

- [[Strava - Sync de atividades]]
- TASK-005, TASK-006
