---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B02: Refactor de Database Schema

Adicionou Equipment, WeeklyGoal, UserEffortZone, UserGoal, Assessment, AiReasoning, AiPlannerPromptLog, WaitlistEntry.

## Status

**Implementado** — 14 tabelas em produção.

## Contexto

Schema inicial era simples. Necessidade de suportar:
- Planos semanais (WeeklyGoal)
- Avaliação inicial (Assessment)
- Zonas de esforço (UserEffortZone)
- Equipamentos (Equipment)
- Auditoria IA (AiReasoning, AiPlannerPromptLog)
- Waitlist (WaitlistEntry)

## Decisão

Expandir schema com 8 novas tabelas (14 total).

## Modelos adicionados

| Tabela | Propósito |
|--------|-----------|
| Equipment | catálogo de equipamentos |
| UserEquipment | N:N User-Equipment |
| WeeklyGoal | objetivo semanal (7 workouts) |
| Assessment | avaliação inicial (5 sessões) |
| UserEffortZone | zonas customizadas |
| UserGoal | objetivo running (maratona, 10k, etc.) |
| AiReasoning | audit trail de decisões IA |
| AiPlannerPromptLog | log prompt+response (debugging) |
| WaitlistEntry | fila beta |

## Justificativa

- Flexibilidade (JSON fields para blocks, metrics, answers)
- Auditoria completa (AiPlannerPromptLog)
- Suporta casos de uso reais (múltiplos goals, zones)

## Alternativas

- Single table com JSONB (menos estruturado)
- Elasticsearch (overkill agora)

---

Ver: [[_MOC Modelos]], [[Stack Backend]]
