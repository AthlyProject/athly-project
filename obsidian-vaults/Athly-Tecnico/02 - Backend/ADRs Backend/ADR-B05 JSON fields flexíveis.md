---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B05: JSON fields flexíveis (blocks, metrics, answers)

Usar JSON type columns para dados semi-estruturados.

## Status

**Implementado**.

## Decisão

Fields JSON em:
- `Workout.blocks` — estrutura de treino
- `WeeklyGoal.metrics` — agregados semanais
- `Assessment.answers` — respostas de sessões
- `UserGoal.metadata` — dados customizados

## Exemplo: Workout.blocks

```json
{
  "warmUp": { "duration_min": 5, "type": "easy" },
  "main": { "duration_min": 35, "distance_km": 7, "type": "tempo", "intensity": 0.75 },
  "coolDown": { "duration_min": 5, "type": "easy" }
}
```

## Justificativa

1. **Flexibilidade**: IA gera blocos variados
2. **Sem migração**: adicionar novos fields é trivial
3. **Performance**: JSON queries em PostgreSQL
4. **Tipo-safety**: validação em API layer (Zod, class-validator)

## Consequências

- Validação em app-level (não DB-level)
- Indexing mais caro se necessário

---

Ver: [[Workout]], [[WeeklyGoal]], [[Assessment]]
