---
tags: [tipo/view, camada/ios, dominio/treino]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Dashboard e History

## Propósito
Tela home (dashboard) e histórico consolidado de corridas + workouts.

## Views incluídas
- `DashboardView` (home do app — treino de hoje + stats rápidos + CTA)
- `HistoryView` (lista cronológica de [[RunSession]] + [[Workout]] concluídos)
- `StatsView` (gráficos de volume, pace, heart rate ao longo do tempo)

## ViewModels usados
- [[TrainingPlanViewModel]] (treino de hoje)
- [[RunStore]] (corridas locais)
- [[HealthKitRunsViewModel]] (opcional — HealthKit como fonte adicional)

## Dependências
- [[Components reutilizáveis]]
- Swift Charts (para gráficos)

## Notas
- DashboardView é a primeira tab — decisão de UX consistente com [[DashboardPage]] do web
- HistoryView combina sources (app + HealthKit) — dedup por proximidade temporal (planejado)
