---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 5 — AI Service

## Descrição

Integrar IA (Claude/Gemini) para gerar planos de treino baseado em histórico e preferências.

## Tasks Relacionadas

- [[TASK-012 - Instalar Anthropic SDK]]
- [[TASK-013 - AiModule e AiService]]
- [[TASK-014 - generateWeeklyPlan]]

## Critérios de Aceite

✅ Pacote IA instalado (@anthropic-ai ou @google/generative-ai)  
✅ AiModule/AiService criado com método `generateWeeklyPlan(userId)`  
✅ Entrada: histórico Strava (30d) + preferências do usuário  
✅ Saída: JSON com 7 workouts (seg-dom)  
✅ Validação JSON structure antes de salvar  
✅ Error handling: fallback a Assessment Plan se IA falhar  
✅ Testes com mock de IA response  

## ADRs Relacionadas

- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]

## Dependências

**Bloqueado por:** [[Épico 3 - Strava Sync Service]], [[Épico 4 - User Preferences]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
