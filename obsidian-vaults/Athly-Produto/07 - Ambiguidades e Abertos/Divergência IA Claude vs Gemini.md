---
tags: [tipo/ambiguidade, contexto/produto, status/aberto]
status: done
created: 2026-04-24
---

# Divergência — IA Claude vs Gemini

## Pergunta

**MVP_PRD especifica Claude Sonnet 4.6, mas implementação usa Gemini 2.5-flash. Qual usar?**

---

## Contexto

- MVP_PRD.md: "LLM: Claude Sonnet 4.6 (Anthropic)"
- Código: GeminiService.ts com `@google/generative-ai`
- Razão: Provavelmente latência + custo + facilidade de integração

---

## Opções Consideradas

### 1. Manter Gemini (Status Quo)
**Prós:**
- Zero retrabalho
- Latência ultra-baixa
- Custo baixo
- Já em produção

**Contras:**
- Divergência de PRD
- Menos raciocínio sofisticado
- Menos histórico de uso

**Ação:** Atualizar MVP_PRD para documentar mudança

---

### 2. Migrar para Claude
**Prós:**
- Alinhado com especificação
- Melhor raciocínio
- Maior context window (200k)
- Melhor suporte português

**Contras:**
- Retrabalho: GeminiService → ClaudeService
- Latência um pouco maior
- Custo maior (pay-per-token)
- Mudança em produção

**Ação:** Criar task "Refactor IA Service para Claude Sonnet"

---

### 3. Híbrido (Ambos)
**Prós:**
- Fallback se um falhar
- Otimização por caso de uso

**Contras:**
- Complexidade dobrada
- Manutenção duplicada
- Mais pontos de falha

**Não recomendado**

---

## Recomendação

**Opção 1 (Manter Gemini)** é viável se:
- Qualidade/latência atual é satisfatória
- Testes em produção confirmam ok
- Custo está sob controle

**Opção 2 (Migrar Claude)** é necessária se:
- Qualidade IA é insuficiente (planos ruins)
- Reliability é crítica (não pode falhar)
- Budget permite custo maior

---

## Próximos Passos

1. PO **decide:** Manter ou migrar?
2. **Documentar** em ADR-FINAL
3. **Implementar** conforme decisão
4. **Atualizar** MVP_PRD.md

---

## Referências

- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]
- [[IA - Claude planejado]]
- [[IA - Gemini implementado]]
