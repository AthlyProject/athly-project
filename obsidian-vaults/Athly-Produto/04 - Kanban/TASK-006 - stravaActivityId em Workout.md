---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 2 - Schema Migrations"
prioridade: alta
---

# TASK-006 — stravaActivityId em Workout

## Descrição

Migration: adicionar stravaActivityId (UNIQUE) e source em Workout.

## Critérios de Aceite

- [ ] Migration: add `stravaActivityId` (VARCHAR, UNIQUE, nullable)
- [ ] Migration: add `source` (ENUM: strava, ai, manual)
- [ ] Default source = 'manual'
- [ ] Index em stravaActivityId para dedup check
- [ ] Migration testada (up/down)

## Schema

```sql
ALTER TABLE Workout ADD COLUMN (
  stravaActivityId VARCHAR(255) UNIQUE,
  source ENUM('strava', 'ai', 'manual') DEFAULT 'manual'
);
```

## Referências

- [[ADR-005 - Distinção visual Strava IA Manual]]
- [[Strava - Sync de atividades]]
