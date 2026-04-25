# Athly Produto — Vault Obsidian

Bem-vindo ao vault de **Produto e Estratégia** do Athly.

## O que é este vault?

Este é o espaço centralizado para toda a documentação de **visão, decisões, épicos, tarefas e integrações** do Athly — um personal trainer inteligente para corredores.

Athly em 1 frase: **Um personal trainer que aprende com o histórico real de treinos do atleta (via Strava) e gera planos semanais personalizados usando IA.**

## Como usar

1. **Abrir o vault:** `Arquivo > Abrir cofre > Athly-Produto`
2. **Instalar plugins recomendados:**
   - Dataview (community plugin) — exibir tabelas dinâmicas de tasks, ADRs, épicos
   - Canvas é core — já vem instalado
3. **Comece pelo Home:** [[00 - Home]]

## Estrutura do vault

| Pasta | Objetivo |
| --- | --- |
| **01 - Visão** | Visão do produto, personas, proposta de valor, loop do MVP, glossário |
| **02 - Decisões (ADRs)** | Arquitetura de decisões (Architecture Decision Records) |
| **03 - Épicos** | Épicos do MVP — agrupamentos de features |
| **04 - Kanban** | Tasks do MVP com status e dependências (Dataview) |
| **05 - Integrações** | Documentação de Strava, IA (Claude/Gemini), detalhes técnicos |
| **06 - Onboarding** | Questionário de onboarding do usuário — 7 seções |
| **07 - Ambiguidades e Abertos** | Gaps, dúvidas em aberto, decisões pendentes |
| **Canvas** | Diagramas visuais: Loop do MVP, Fluxo OAuth, Geração Semanal |
| **Templates** | Templates para criar novas ADRs, tasks, épicos |

## Navegação rápida

- **Dashboards:** [[00 - Home]], [[04 - Kanban/_Kanban Board]]
- **Decisões importantes:** [[02 - Decisões (ADRs)/_MOC Decisões de Produto]]
- **Strava (integração chave):** [[05 - Integrações/Strava - Visão geral]]
- **Gap IA (Claude vs Gemini):** [[02 - Decisões (ADRs)/ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]
- **Onboarding:** [[06 - Onboarding/_MOC Onboarding]]

## Convenções

- **Wikilinks:** Use `[[Page]]` para linkar notas
- **Tags:** Cada nota tem `tags: [tipo/adr, contexto/produto, status/todo]`
- **Frontmatter YAML:** Todas as notas têm metadados (status, created, contexto)
- **ADRs:** Formato clássico (Contexto → Decisão → Consequências)
- **Tasks:** Vinculadas a épicos, com critérios de aceite e prioridade

## Referências externas

- **MVP_PRD.md** — especificação de produto (fonte)
- **MVP_KANBAN.md** — kanban original com 21 tasks
- **STRAVA_INTEGRATION_PLAN.md** — plano detalhado de OAuth, sync, refresh
- **Google Gemini 2.5-flash** — implementação atual de IA (não Claude como plano)

---

**Vault atualizado:** 2026-04-24
**Contexto:** Produto e Estratégia
**Idioma:** Português (Brasil)
