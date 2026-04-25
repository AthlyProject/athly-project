---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B06: AiPlannerPromptLog para auditoria

Armazenar prompt completo + raw response da IA para debugging e ML.

## Status

**Implementado**.

## Decisão

Persist toda chamada à IA:
- `promptSent` — texto completo
- `responseRaw` — resposta bruta
- `responseParsed` — JSON estruturado
- `tokensUsed`, `durationMs`, `success`

## Justificativa

1. **Debugging**: "por que gerei esse workout?"
2. **Machine learning**: tunar prompts com dados reais
3. **Custo tracking**: tokens por chamada
4. **Compliance**: auditoria completa

## Exemplo

```json
{
  "promptVersion": "v3.0",
  "promptSent": "Generate 7 workouts for...",
  "responseRaw": "{\"workouts\": [...]}",
  "tokensUsed": 8541,
  "durationMs": 1250,
  "success": true
}
```

## Trade-offs

- Storage: ~10KB por chamada (< 1MB/dia em 100 users)
- Privacy: prompts contêm user data (deve encryptar?)

---

Ver: [[AiPlannerPromptLog]], [[AiPlannerService]]
