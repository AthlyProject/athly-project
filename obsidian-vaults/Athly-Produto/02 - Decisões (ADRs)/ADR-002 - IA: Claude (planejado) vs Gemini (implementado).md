---
tags: [tipo/adr, contexto/produto, status/aberto]
status: done
created: 2026-04-24
adr_number: 2
---

# ADR-002 — IA: Claude (Planejado) vs Gemini (Implementado)

## Status
**Aberto** — Requer decisão de negócio

## Contexto

Existe **divergência significativa** entre o que foi documentado (MVP_PRD.md) e o que foi implementado:

**MVP_PRD.md especifica:**
```
LLM: Claude Sonnet 4.6 (Anthropic)
```

**Código implementado (GeminiService.ts):**
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
```

**package.json:**
```json
"@google/generative-ai": "^0.3.0"
```

Este gap precisa ser **resolvido e documentado** como uma decisão consciente.

---

## Análise Comparativa

### Claude Sonnet 4.6 (Anthropic)
**Prós:**
- Maior contexto window (200k tokens)
- Raciocínio mais robusto para problemas complexos
- Suporte via Anthropic SDK Python/Node
- Melhor em nuances de linguagem (português)

**Contras:**
- Custo potencialmente maior por token
- Latência um pouco maior
- Quotas de rate limiting

### Gemini 2.5-flash (Google)
**Prós:**
- Latência baixa (flash = otimizado para speed)
- Pricing agressivo
- Integração fácil com ecosystem Google
- Modelo novo (2.5 em 2026)

**Contras:**
- Context window menor (~1M tokens, mas ~100k prático)
- Menos histórico de uso em produção
- Suporte a português menos testado

---

## Opções

### 1. Manter Gemini (status quo)
**Decisão:** "Implementação como está é ótima, documentar mudança em PRD"
- ✅ Sem retrabalho
- ✅ Latência baixa já em produção
- ❌ PRD fica desatualizado
- ❌ Próximos devs confusos

### 2. Migrar para Claude
**Decisão:** "Especificação original é correcta, migrar GeminiService → ClaudeService"
- ✅ Alinhado com PRD
- ✅ Maior confiabilidade
- ❌ Retrabalho (substituir @google/generative-ai por Anthropic SDK)
- ❌ Custo potencialmente maior

### 3. Híbrido (ambos)
**Decisão:** "Claude para lógica complexa, Gemini para fallback/custo"
- ✅ Redundância
- ✅ Otimização por caso de uso
- ❌ Complexidade muito maior
- ❌ Manutenção duplicada

---

## Recomendação

**Opção 1 (Manter Gemini) é recomendada se:**
- ✅ Gemini está funcionando em produção
- ✅ Latência é satisfatória
- ✅ Custos estão sob controle
- ✅ Equipe confortável com Google APIs

**Opção 2 (Migrar Claude) é recomendada se:**
- ✅ Qualidade/reliability é prioritária
- ✅ Contexto maior é crítico para planos complexos
- ✅ Budget permite custo maior

---

## Próximos Passos

1. **Product Owner decide:** Manter Gemini ou migrar Claude?
2. **Documentar decisão:** Atualizar PRD e/ou criar ADR_DECISION.md
3. **Se migrar:** Criar task "Refactor IA Service Claude Sonnet"
4. **Atualizar:** package.json, GeminiService → ClaudeService, testes

---

## Referências

- MVP_PRD.md (especifica Claude Sonnet 4.6)
- Backend: `GeminiService.ts` (implementa Gemini 2.5-flash)
- package.json: "@google/generative-ai"
- [[05 - Integrações/IA - Claude planejado]]
- [[05 - Integrações/IA - Gemini implementado]]
