---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 9
---

# ADR-009 — Distância Alvo Limitada a 24 Semanas

## Status
**Aceito** — Validação no onboarding (Seção 3)

## Decisão

Usuário não pode definir `distanceTarget` com prazo **maior que 24 semanas** (6 meses).

### Validação no onboarding
```
"Quando quer correr 21.1km?"
→ Máximo 24 semanas do hoje
→ Se > 24, erro: "Máximo 6 meses. Refine a meta."
```

### Por quê?
- ✅ Segurança: Progressão muito agressiva é perigosa
- ✅ Realismo: Meia maratona em 6 meses é viável; 2 anos é procrastinação
- ✅ IA: Janela apropriada para estruturar treino
- ✅ Retenção: Prazo curto motiva mais

### Progressão Segura
```
5km  → 4-6 semanas (iniciante)
10km → 8-12 semanas (intermediário)
21.1km → 12-24 semanas (avançado)
42.2km → fora do MVP
```

---

## Referências

- [[06 - Onboarding/Seção 3 - Planejamento]]
