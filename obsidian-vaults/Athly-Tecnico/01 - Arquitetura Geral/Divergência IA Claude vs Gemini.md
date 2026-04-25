---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# Divergência IA: Claude vs Gemini

**ADR-B03** — Escolha de Gemini 2.5-flash em vez de Claude Sonnet 4.6.

## Status

**Implementado** — usando Gemini 2.5-flash em produção.

## Contexto

Plano inicial previa Claude Sonnet 4.6 para geração de planos de treino via AiPlannerService. Mudança estratégica optou por Gemini 2.5-flash.

## Decisão

Usar **@google/generative-ai 0.24.1** (Gemini 2.5-flash) como modelo IA principal para:
- Geração de planos semanais (AiPlannerService)
- Parsing de objetivos (goal-parser-prompt)
- Análise de assessments

## Justificativa

1. **Custo**: Gemini é mais barato que Claude Sonnet (importante para escala)
2. **Latência**: resposta rápida (importante para UX)
3. **Disponibilidade**: Google Generative AI é estável e simples de integrar
4. **JSON mode**: suporte nativo a JSON responses estruturadas
5. **Context window**: 1M tokens (suficiente para contexto histórico)

## Consequências

**Positivas:**
- Redução de custos operacionais
- Integração simplificada (SDK direto, sem Anthropic API)
- Respostas estruturadas e previsíveis

**Negativas:**
- Menos "reasoning depth" que Claude em cenários complexos
- Menos customização de system prompts

## Alternativas consideradas

- **Claude Sonnet 4.6**: mais powerful, custo maior
- **Llama (open-source)**: self-hosted, maior overhead operacional
- **GPT-4o (OpenAI)**: integração com Azure, custo médio

## Referências

- [[GeminiService]] — wrapper e integração
- [[AiPlannerService]] — orquestração
- [[Planner Prompt v3]] — prompt atual
- `/src/tools/generat-plan-nextweek` (backend NestJS)

---

**Nota**: Avaliação de swap para Claude pode ser revisitada se latência/custo/qualidade mudar.
