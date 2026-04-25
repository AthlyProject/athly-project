---
tags: [tipo/integracao, contexto/produto]
status: done
created: 2026-04-24
---

# IA — Gemini Implementado

## Implementação Atual (Backend)

**LLM:** Google Gemini 2.5-flash  
**Arquivo:** `GeminiService.ts`  
**Package:** `@google/generative-ai`

---

## Características

| Atributo | Valor |
| --- | --- |
| **Provider** | Google |
| **Model** | gemini-2.5-flash |
| **Context Window** | ~1M tokens (prático ~100k) |
| **Speed** | Muito rápido (flash = otimizado) |
| **Custo** | Muito barato (~US$ 0.0001 por 1000 input tokens) |
| **Reasoning** | Bom (menos que Claude, mas suficiente) |

---

## Vantagens

✅ Latência ultra-baixa (flash é rápido)  
✅ Custo muito agressivo  
✅ Modelo novo em 2026 (atualizado)  
✅ Integração Google ecosystem  
✅ Suporte a português  

---

## Desvantagens

❌ Context window menor (menor histórico)  
❌ Menos histórico de uso em produção  
❌ Raciocínio menos sofisticado que Claude  
❌ Menos testado em português (inicialmente)  

---

## SDK & Integração

```bash
npm install @google/generative-ai
```

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_API_KEY
);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const result = await model.generateContent(prompt);
const text = result.response.text();
```

---

## Status

✅ **Implementado em produção**  
⚠️ **Divergência:** MVP_PRD especifica Claude  
→ Requer resolução em [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]

---

## Opções de Ação

### 1. Manter Gemini (Status Quo)
- Sem retrabalho
- Atualizar MVP_PRD para documentar mudança

### 2. Migrar para Claude
- Alinhado com especificação
- Retrabalho: trocar GeminiService → ClaudeService
- Custo potencialmente maior

### 3. Híbrido
- Claude para lógica complexa
- Gemini para fallback/custo
- Complexidade aumenta

---

## Referências

- Backend: `GeminiService.ts`
- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]
- [[IA - Claude planejado]]
