---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: AiPlannerPromptLog

Log completo de chamadas à IA (auditoria, debugging, melhorias).

## Propósito

Armazenar prompt enviado + resposta bruta da IA para auditoria + machine learning.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| weeklyGoalId | UUID | true | FK WeeklyGoal (se aplicável) |
| promptVersion | String | false | "v3.0" |
| promptSent | String | false | prompt completo (text) |
| responseRaw | String | false | resposta bruta (JSON) |
| responseParsed | JSON | true | JSON parsed (estruturado) |
| tokensUsed | Int | true | tokens processados |
| model | String | false | "gemini-2.5-flash" |
| durationMs | Int | true | latência da chamada |
| success | Boolean | false | true = parse bem-sucedido |
| errorMessage | String | true | erro se houver |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User
- N:1 WeeklyGoal (opcional)

## Usado em

- [[AiPlannerService]] → log a cada chamada
- Debugging: "o que a IA viu?"
- Analytics: custo, latência, taxa de sucesso

## Notas

- Armazenar completo (privacidade deve ser considerada)
- Índices: (userId, createdAt) para queries históricas
- Dados para ML future: tuning de prompts

---

Ver: [[AiPlannerService]], [[Planner Prompt v3]], [[_MOC Modelos]]
