---
tags: [tipo/servico, camada/frontend, dominio/historico]
tipo: servico
camada: frontend
arquivo: src/services/historyService.ts
status: implementado
created: 2026-04-24
---

# historyService

## Propósito
Retornar o histórico de treinos (done + skipped) do usuário para exibir na [[HistoryPage]].

## API pública

| Método | Endpoint |
|--------|----------|
| `getWorkoutHistory()` | [[GET workouts-history]] |

## Consumido por
- [[HistoryPage]]

## Shape do retorno
Array de [[Workout]] com `status: done | skipped | partial`, contendo `stravaActivityId?` para badge de origem (Strava/IA/Manual).

## Tratamento de erros
- Fallback array vazio em caso de erro

## Notas
- A origem do treino é inferida no frontend:
  - `stravaActivityId` → badge Strava
  - gerado por IA (presença de `weeklyGoalId` + sem `stravaActivityId`) → badge IA
  - manual → nenhum dos acima
