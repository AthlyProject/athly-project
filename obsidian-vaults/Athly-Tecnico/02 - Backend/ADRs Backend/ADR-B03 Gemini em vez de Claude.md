---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B03: Gemini em vez de Claude

Fevereiro 2026. Escolha de Gemini 2.5-flash divergindo do plano (Claude Sonnet 4.6).

## Status

**Implementado** — Gemini em produção.

## Contexto

Roadmap inicial previa Claude Sonnet 4.6. Reavaliação de trade-offs.

## Decisão

Usar @google/generative-ai 0.24.1 (Gemini 2.5-flash).

## Critérios

| Aspecto | Gemini | Claude |
|---------|--------|--------|
| Custo | Baixo | Médio-alto |
| Latência | Rápido | Rápido |
| JSON mode | Nativo | Via system prompt |
| Context | 1M tokens | 200k tokens |
| Reasoning | Bom | Excelente |

## Justificativa

1. **Custo operacional**: crítico para escala
2. **JSON response**: suporte nativo
3. **Latência aceitável**: < 2s para geração
4. **Context suficiente**: 1M tokens > 200k histórico

## Consequências

**Positivas:**
- Custo 60% menor vs. Claude
- Resposta estruturada garantida
- Integração simples

**Negativas:**
- Menos "reasoning depth" em casos edge
- Menos customização de system prompts
- Menos "understanding" de nuances

## Quando reavaliar

- Se latência > 3s
- Se custo mente reduzir
- Se qualidade cair (< 80% acerto parsing)

---

Ver: [[Divergência IA Claude vs Gemini]], [[GeminiService]], [[AiPlannerService]]
