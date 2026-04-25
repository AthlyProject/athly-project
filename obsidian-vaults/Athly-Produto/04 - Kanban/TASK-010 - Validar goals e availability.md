---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 4 - User Preferences"
prioridade: media
---

# TASK-010 — Validar Goals e Availability

## Descrição

Implementar validações para goals do usuário e dias disponíveis para treinar.

## Critérios de Aceite

- [ ] Validação: distanceTarget ∈ [5, 10, 21.1, 42.2] km
- [ ] Validação: timeFrameWeeks ≤ 24 (máx 6 meses)
- [ ] Validação: availability é bitmask seg-dom (min 1 dia, max 7)
- [ ] Validação: goals não vazio (descrição 10-500 chars)
- [ ] Erros claros em português
- [ ] Testes de validação (edge cases)

## Schema UserPreference

```
distanceTarget: 5 | 10 | 21.1 | 42.2
timeFrameWeeks: 1-24
availability: bitmask (0b1111111 = seg-dom)
goals: string (10-500)
```

## Referências

- [[ADR-009 - Distância alvo limitada a 24 semanas]]
- TASK-011
