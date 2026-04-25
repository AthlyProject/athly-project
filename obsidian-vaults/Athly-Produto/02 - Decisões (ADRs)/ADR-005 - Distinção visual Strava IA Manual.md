---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 5
---

# ADR-005 — Distinção Visual Strava/IA/Manual

## Status
**Aceito** — Implementado em TASK-019

## Decisão

Cada workout card no dashboard mostra **badge de origem:**

- **🟦 Strava** — sincronizado de Strava (workout.source = "strava")
- **🤖 IA** — gerado por IA (workout.source = "ai")
- **✏️ Manual** — editado pelo usuário (workout.source = "manual")

### Benefícios
✅ Transparência: usuário sabe de onde vem cada treino  
✅ Confiança: dados reais são diferenciados de gerados  
✅ Edição clara: ao fazer override, fica manual  
✅ Auditoria: rastreia origem para refinar IA  

### Implementação
- Campo `Workout.source` em BD
- Badge CSS simples (ícone + cor)
- Ao editar, `source = "manual"` sobrescreve "ai"

---

## Referências

- TASK-019
- [[05 - Integrações/Strava - Visão geral]]
