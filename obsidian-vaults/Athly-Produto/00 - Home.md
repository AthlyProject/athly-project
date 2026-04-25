---
tags: [contexto/produto, tipo/home]
status: done
created: 2026-04-24
---

# Athly — Dashboard Produto

Bem-vindo ao vault de **visão, decisões, épicos e tarefas** do Athly.

## Resumo Executivo

**Produto:** Personal trainer inteligente para corredores  
**Loop:** Conectar Strava → Sincronizar → Gerar Plano IA → Exibir → Repetir  
**Status:** MVP em desenvolvimento (21 tasks)  
**Linguagem:** Português (Brasil)

---

## Navegação Rápida

| Seção | Link | Descrição |
| --- | --- | --- |
| **Visão** | [[01 - Visão/_MOC Visão]] | Personas, proposta de valor, loop |
| **Decisões** | [[02 - Decisões (ADRs)/_MOC Decisões de Produto]] | ADRs e decisões arquiteturais |
| **Épicos** | [[03 - Épicos/_MOC Épicos]] | 8 épicos do MVP |
| **Kanban** | [[04 - Kanban/_Kanban Board]] | 21 tasks com status |
| **Integrações** | [[05 - Integrações/_MOC Integrações]] | Strava, IA, detalhes técnicos |
| **Onboarding** | [[06 - Onboarding/_MOC Onboarding]] | Questionário em 7 seções |
| **Abertos** | [[07 - Ambiguidades e Abertos/_MOC Abertos]] | Gaps e dúvidas |
| **Canvas** | Canvas/ | Diagramas (Loop, OAuth, Cron) |

---

## Métricas Rápidas

```dataview
TABLE WITHOUT ID
  concat(choice(status="todo","🔴 ",choice(status="doing","🟡 ","✅ ")), file.link) as Task,
  epico as Épico,
  prioridade as Prioridade
FROM "04 - Kanban"
WHERE tipo = "task"
SORT epico ASC, prioridade DESC
```

---

## ADRs Ativas

```dataview
TABLE WITHOUT ID
  file.link as ADR,
  status as Status
FROM "02 - Decisões (ADRs)"
WHERE contains(file.name, "ADR-")
SORT file.name ASC
```

---

## Épicos (8 total)

1. [[03 - Épicos/Épico 1 - Strava OAuth]] — Fluxo OAuth per-user
2. [[03 - Épicos/Épico 2 - Schema Migrations]] — Campos OAuth, stravaActivityId
3. [[03 - Épicos/Épico 3 - Strava Sync Service]] — Sincronização de atividades
4. [[03 - Épicos/Épico 4 - User Preferences]] — Validar goals e availability
5. [[03 - Épicos/Épico 5 - AI Service]] — Integração com IA (Gemini/Claude)
6. [[03 - Épicos/Épico 6 - Training Plan Generation]] — Endpoint para gerar plano
7. [[03 - Épicos/Épico 7 - Weekly Loop (Cron)]] — Regeneração automática seg 6h
8. [[03 - Épicos/Épico 8 - Frontend Integration]] — Badges, botão, OAuth modal

---

## Abertos Críticos

⚠️ **Claude vs Gemini:** [[02 - Decisões (ADRs)/ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]  
Plano: Claude Sonnet 4.6 | Implementação: Google Gemini 2.5-flash

⚠️ **Outros gaps:** [[07 - Ambiguidades e Abertos/_MOC Abertos]]

---

## Canvas (Diagramas)

- [[Loop do MVP.canvas]] — 5 etapas + decisões
- [[Fluxo OAuth Strava.canvas]] — Frontend/Backend/Strava
- [[Geração Semanal de Plano.canvas]] — Cron → Sync → IA → Notify

---

## Links Externos

- **MVP_PRD.md** — Especificação original
- **MVP_KANBAN.md** — 21 tasks (fonte)
- **STRAVA_INTEGRATION_PLAN.md** — Plano OAuth/Sync

---

**Última atualização:** 2026-04-24
