---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 7 - Weekly Loop (Cron)"
prioridade: media
---

# TASK-017 — Instalar @nestjs/schedule

## Descrição

Instalar e configurar módulo de agendamento NestJS.

## Critérios de Aceite

- [ ] `npm install @nestjs/schedule`
- [ ] ScheduleModule importado em AppModule
- [ ] ConfigModule acessível (para timezone)
- [ ] Teste básico: cron simples rodando
- [ ] package.json atualizado

## Configuração

```typescript
// app.module.ts
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    // ...
  ],
})
export class AppModule {}
```

## Referências

- [[ADR-004 - Regeneração automática semanal via Cron]]
- TASK-018
