---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 2 - Schema Migrations"
prioridade: alta
---

# TASK-005 — Campos OAuth em Integration

## Descrição

Migration: adicionar campos Strava OAuth na table Integration.

## Critérios de Aceite

- [ ] Migration criada: add columns stravaAccessToken, stravaRefreshToken, stravaExpiresAt
- [ ] Columns nullable (usuário pode não ter Strava)
- [ ] Index em `Integration(userId)` para busca rápida
- [ ] Migration testada (up/down)
- [ ] Seed data ou teste com mock

## Schema

```sql
ALTER TABLE Integration ADD COLUMN (
  stravaAccessToken VARCHAR(255),
  stravaRefreshToken VARCHAR(255),
  stravaExpiresAt TIMESTAMP
);
```

## Referências

- [[ADR-003 - OAuth per-user, não env var global]]
- TASK-001 → TASK-003
