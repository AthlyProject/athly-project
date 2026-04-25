---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 7 - Weekly Loop (Cron)"
prioridade: media
---

# TASK-018 — Cron Job Semanal

## Descrição

Implementar cron que regenera planos toda segunda-feira 6h.

## Critérios de Aceite

- [ ] `@Cron('0 6 * * 1')` decorator na função
- [ ] Para cada User com Integration.stravaAccessToken:
  - Refresh token se expirado
  - Sync últimos 30 dias (TASK-008)
  - Gera novo plano IA (TASK-014)
  - Sobrescreve TrainingPlan anterior
  - Envia notificação (push/email)
- [ ] Error handling: retry 3x, log failures
- [ ] Jitter na execução (distribuir carga)
- [ ] Testes com mock scheduler

## Código Esperado

```typescript
@Cron('0 6 * * 1') // Seg 6h
async regenerateWeeklyPlans() {
  // Implementação
}
```

## Referências

- [[ADR-004 - Regeneração automática semanal via Cron]]
- TASK-017
- [[Loop do MVP]]
