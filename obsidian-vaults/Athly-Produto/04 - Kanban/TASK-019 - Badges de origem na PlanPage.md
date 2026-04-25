---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 8 - Frontend Integration"
prioridade: media
---

# TASK-019 — Badges de Origem na PlanPage

## Descrição

Frontend: mostrar badges visuais na dashboard indicando origem do workout.

## Critérios de Aceite

- [ ] Componente WorkoutCard mostra badge:
  - 🟦 Strava (source = "strava")
  - 🤖 IA (source = "ai")
  - ✏️ Manual (source = "manual")
- [ ] Badge posicionado canto superior direito
- [ ] Tooltip ao hover: "Sincronizado de Strava" / "Gerado por IA" / "Editado manualmente"
- [ ] CSS responsivo
- [ ] Testes: rendering com diferentes sources

## Componente

```tsx
<WorkoutCard source="ai">
  <Badge type={source} />
  {/* ... */}
</WorkoutCard>
```

## Referências

- [[ADR-005 - Distinção visual Strava IA Manual]]
- TASK-006
