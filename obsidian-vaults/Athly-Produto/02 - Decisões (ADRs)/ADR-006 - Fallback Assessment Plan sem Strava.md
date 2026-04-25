---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 6
---

# ADR-006 — Fallback Assessment Plan Sem Strava

## Status
**Aceito** — Implementado em formulário de onboarding

## Decisão

Usuário **não é forçado a conectar Strava**. Se recusa:
1. Recebe Assessment Plan (5 treinos genéricos iniciais)
2. Sistema coleta preferências (goals, availability, PAR-Q)
3. Plano é básico, mas funcional
4. Pode conectar Strava depois → resync automático

### Por quê?
- ✅ Reduz friction (não quer compartilhar dados? tudo bem)
- ✅ Ninguém sai sem plano
- ✅ IA ainda funciona com preferências coletadas
- ✅ Strava é opt-in, não obrigatório

### Fluxo
```
Novo usuário
  ↓
"Quer conectar Strava?"
  ├─ SIM  → OAuth → Sync 30d → IA com histórico
  └─ NÃO  → Assessment Plan 5 treinos + coleta prefs → IA com prefs
```

## Assessment Plan (5 treinos genéricos)

```
Seg: Easy Run 5km (30min, recuperação)
Ter: Strength (30min, core + glúteos)
Qua: Tempo Run 5km (25min, ritmo moderado)
Qui: Yoga (20min, mobilidade)
Sex: Long Run 7km (45min, resistência)
Sab/Dom: Rest ou opcional
```

---

## Referências

- [[06 - Onboarding/_MOC Onboarding]]
- [[Proposta de Valor]]
