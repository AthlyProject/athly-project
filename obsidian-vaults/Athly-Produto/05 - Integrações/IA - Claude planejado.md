---
tags: [tipo/integracao, contexto/produto]
status: done
created: 2026-04-24
---

# IA — Claude Planejado

## Especificação Original (MVP_PRD.md)

**LLM:** Claude Sonnet 4.6 (Anthropic)

---

## Características

| Atributo | Valor |
| --- | --- |
| **Provider** | Anthropic |
| **Model** | claude-sonnet-4-6 (ou claude-3-5-sonnet) |
| **Context Window** | 200,000 tokens |
| **Speed** | Moderado (~2-5s por plano) |
| **Custo** | ~US$ 0.003 por 1000 input tokens |
| **Reasoning** | Muito bom (melhor para lógica complexa) |

---

## Vantagens

✅ Context window gigante (200k tokens)  
✅ Raciocínio superior para lógica complexa  
✅ Suporte robusto a português  
✅ Consistência entre chamadas  
✅ Confiabilidade em produção  

---

## Desvantagens

❌ Latência um pouco maior que competitors  
❌ Custo potencialmente maior (pay-per-token)  
❌ Rate limiting por account  
❌ Necessita API key Anthropic (dependência extra)  

---

## SDK & Integração

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await client.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: prompt,
    },
  ],
});
```

---

## Status

⚠️ **Planejado em MVP_PRD**  
⚠️ **Não está implementado** (veja [[IA - Gemini implementado]])  
→ Requer resolução em [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]

---

## Referências

- MVP_PRD.md (fonte)
- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]
- [[IA - Gemini implementado]]
