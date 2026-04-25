---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 5 - AI Service"
prioridade: alta
---

# TASK-012 — Instalar Anthropic SDK

## Descrição

Instalar SDK IA (Anthropic ou Google) no backend.

## Critérios de Aceite

- [ ] Pacote instalado: `npm install @anthropic-ai/sdk` (ou Google)
- [ ] API key configurada em .env (`ANTHROPIC_API_KEY` ou `GOOGLE_API_KEY`)
- [ ] Validação que key existe no startup
- [ ] Teste básico: chamada dummy retorna response
- [ ] package.json atualizado

## Nota sobre IA

⚠️ MVP_PRD especifica Claude Sonnet 4.6  
⚠️ Implementação atual usa Gemini 2.5-flash  
→ Será resolvido em [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]

## Referências

- [[ADR-002 - IA: Claude (planejado) vs Gemini (implementado)]]
- [[05 - Integrações/IA - Claude planejado]]
