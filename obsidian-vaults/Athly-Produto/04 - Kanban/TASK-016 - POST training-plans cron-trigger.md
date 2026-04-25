---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 6 - Training Plan Generation"
prioridade: media
---

# TASK-016 — POST /training-plans/cron-trigger

## Descrição

Endpoint admin para trigger manual do cron (testes, debugging).

## Critérios de Aceite

- [ ] POST `/training-plans/cron-trigger` (admin only)
- [ ] Roda regeneração para todos os usuários com Strava
- [ ] Retorna status: count de usuários processados
- [ ] Logging detalhado (start/end, errors, sucesso)
- [ ] Sem bloqueio (fire-and-forget com bg job)
- [ ] Proteção: IP whitelist ou X-API-Key

## Request/Response

```
POST /training-plans/cron-trigger
X-API-Key: admin_secret

202 Accepted:
{
  "message": "Cron triggered",
  "job_id": "...",
  "scheduled_for": "2026-04-24T10:00:00Z"
}
```

## Referências

- TASK-015
- TASK-018
