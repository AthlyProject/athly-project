---
tags: [tipo/moc, contexto/produto, tipo/epico]
status: done
created: 2026-04-24
---

# MOC — Épicos do MVP

Estrutura dos 8 épicos que compõem o MVP do Athly. Total: 21 tasks.

## Épicos

| # | Épico | Tasks | Status |
| --- | --- | --- | --- |
| **1** | [[Épico 1 - Strava OAuth]] | TASK-001 → TASK-004 | 🟡 doing |
| **2** | [[Épico 2 - Schema Migrations]] | TASK-005 → TASK-006 | 🔴 todo |
| **3** | [[Épico 3 - Strava Sync Service]] | TASK-007 → TASK-009 | 🔴 todo |
| **4** | [[Épico 4 - User Preferences]] | TASK-010 → TASK-011 | 🔴 todo |
| **5** | [[Épico 5 - AI Service]] | TASK-012 → TASK-014 | 🔴 todo |
| **6** | [[Épico 6 - Training Plan Generation]] | TASK-015 → TASK-016 | 🔴 todo |
| **7** | [[Épico 7 - Weekly Loop (Cron)]] | TASK-017 → TASK-018 | 🔴 todo |
| **8** | [[Épico 8 - Frontend Integration]] | TASK-019 → TASK-021 | 🔴 todo |

---

## Dependências

```
Épico 1 (OAuth)
  ↓ (requires)
Épico 2 (Schema) + Épico 3 (Sync)
  ↓
Épico 4 (Preferences) + Épico 5 (IA)
  ↓
Épico 6 (Plan Generation)
  ↓
Épico 7 (Cron Loop)
  ↓
Épico 8 (Frontend)
```

---

**Próximas:** [[04 - Kanban/_Kanban Board]]
