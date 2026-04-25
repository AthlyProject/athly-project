---
tags: [tipo/kanban, contexto/produto]
status: done
created: 2026-04-24
---

# Kanban Board — MVP Tasks

## Status Visão Geral

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  epico as Épico,
  prioridade as Prioridade
FROM "04 - Kanban"
WHERE tipo = "task"
SORT epico ASC, prioridade DESC
```

---

## Por Épico

### Épico 1 — Strava OAuth

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status,
  prioridade as Prioridade
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 1 - Strava OAuth"
SORT prioridade DESC
```

### Épico 2 — Schema Migrations

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 2 - Schema Migrations"
```

### Épico 3 — Strava Sync

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 3 - Strava Sync Service"
```

### Épico 4 — User Preferences

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 4 - User Preferences"
```

### Épico 5 — AI Service

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 5 - AI Service"
```

### Épico 6 — Training Plan Generation

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 6 - Training Plan Generation"
```

### Épico 7 — Weekly Loop (Cron)

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 7 - Weekly Loop (Cron)"
```

### Épico 8 — Frontend Integration

```dataview
TABLE WITHOUT ID
  choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")) + file.link as Task,
  status as Status
FROM "04 - Kanban"
WHERE tipo = "task" AND epico = "Épico 8 - Frontend Integration"
```

---

## Contadores

- **Total:** 21 tasks
- **TODO:** [[04 - Kanban/_Kanban Board#query_todo]]
- **DOING:** [[04 - Kanban/_Kanban Board#query_doing]]
- **DONE:** [[04 - Kanban/_Kanban Board#query_done]]

---

**Próximas:** [[00 - Home]]
