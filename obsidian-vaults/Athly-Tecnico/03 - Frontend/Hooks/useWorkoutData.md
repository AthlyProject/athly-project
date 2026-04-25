---
tags: [tipo/hook, camada/frontend, dominio/treino]
tipo: hook
camada: frontend
arquivo: src/hooks/useWorkout.ts
status: implementado
created: 2026-04-24
---

# useWorkoutData

## Propósito
Hook que centraliza o carregamento inicial de dados de treino (treino de hoje + plano atual) para o [[DashboardPage]]. Evita duplicar lógica de efeito em múltiplos componentes.

## API

```ts
useWorkoutData(): void // não retorna nada; dispara side effects
```

## O que faz ao montar
1. `setLoading(true)` em [[useWorkoutStore]]
2. Chama `workoutService.getTodayWorkout()` ([[workoutService]])
3. Chama `workoutService.getCurrentTrainingPlan()`
4. `setTodayWorkout(...)` e `setCurrentPlan(...)` na store
5. `setLoading(false)`

## Dependências
- [[useWorkoutStore]]
- [[workoutService]]

## Consumido por
- [[DashboardPage]]

## Notas
- Estado compartilhado via store — outras telas podem ler o mesmo cache sem refazer fetch
- Não tem invalidação explícita; recarregar aciona novo fetch
