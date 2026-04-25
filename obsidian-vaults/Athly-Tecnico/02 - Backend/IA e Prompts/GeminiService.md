---
tags: [camada/backend, tipo/servico]
camada: backend
tipo: servico
status: implementado
created: 2026-04-24
---

# Serviço: GeminiService

Wrapper de @google/generative-ai (Gemini 2.5-flash). JSON response mode.

## Propósito

Encapsular chamadas à API Gemini com rate limiting, error handling, response parsing.

## Métodos principais

```ts
async generatePlan(prompt: string, systemPrompt?: string): Promise<{
  content: string;
  tokensUsed: number;
}>

async parseGoal(goalDescription: string): Promise<GoalMetadata>

async analyzeAssessment(answers: AssessmentAnswers): Promise<AssessmentAnalysis>
```

## Configuração

- **Model**: `gemini-2.5-flash`
- **Context window**: 1M tokens
- **Response mode**: JSON (estruturado)
- **Rate limit**: respeitado via logging

## Dependências

- `@google/generative-ai` 0.24.1
- env: `GOOGLE_GENERATIVE_AI_KEY`

## Fluxo típico

1. AiPlannerService chama GeminiService.generatePlan()
2. Monta systemPrompt + userPrompt
3. Gemini retorna JSON estruturado
4. Parse + validação
5. Log em AiPlannerPromptLog

---

Ver: [[AiPlannerService]], [[_MOC IA e Prompts]], [[Divergência IA Claude vs Gemini]]
