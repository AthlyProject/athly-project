---
tags: [tipo/moc, contexto/produto, tipo/adr]
status: done
created: 2026-04-24
---

# MOC — Decisões de Produto (ADRs)

Mapa de Arquitetura de Decisões do Athly. Cada ADR documenta contexto, decisão, consequências e alternativas.

## ADRs Ativas

```dataview
TABLE WITHOUT ID
  file.link as ADR,
  status as Status,
  created as Criada
FROM "02 - Decisões (ADRs)"
WHERE contains(file.name, "ADR-")
SORT file.name ASC
```

---

## Por Tópico

### Estratégia de Produto
- [[ADR-001 - Loop do MVP como critério de sucesso]] → Conectar → Sincronizar → Gerar → Exibir → Repetir

### IA & Generação
- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]] ⚠️ **CRÍTICO** — Gap entre plano e implementação

### Integrações
- [[ADR-003 - OAuth per-user, não env var global]] → Cada usuário conecta própria conta
- [[ADR-007 - Janela de 30 dias para histórico Strava]] → Balanceamento contexto/performance

### Automação
- [[ADR-004 - Regeneração automática semanal via Cron]] → Segunda-feira 6h
- [[ADR-006 - Fallback Assessment Plan sem Strava]] → Ninguém fica sem plano

### UX & Visualização
- [[ADR-005 - Distinção visual Strava IA Manual]] → Badges nos workouts

### Saúde & Compliance
- [[ADR-008 - PAR-Q obrigatório no onboarding]] → Questões de screening
- [[ADR-009 - Distância alvo limitada a 24 semanas]] → Segurança de progressão

---

## Status Síntese

| Status | Descrição |
| --- | --- |
| **Aceito** | Decisão tomada, implementação em progresso |
| **Proposto** | Discussão em aberto |
| **Aberto** | Requer decisão |
| **Superseded** | Substituído por ADR mais recente |

---

**Próximas:** [[00 - Home]], [[03 - Épicos/_MOC Épicos]]
