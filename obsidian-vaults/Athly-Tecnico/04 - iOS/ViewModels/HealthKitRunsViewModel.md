---
tags: [tipo/viewmodel, camada/ios, dominio/healthkit]
tipo: viewmodel
camada: ios
arquivo: AthlyRunner/ViewModels/HealthKitRunsViewModel.swift
status: implementado
created: 2026-04-24
---

# HealthKitRunsViewModel

## Propósito
Expõe a lista de corridas importadas do HealthKit para [[Profile e HealthKit Views]], permitindo ao usuário revisar e vincular a workouts do plano.

## Estado exposto
- `@Published var items: [HealthKitRunItem]`
- `@Published var isLoading: Bool`
- `@Published var authorizationStatus: HKAuthorizationStatus`

## Ações
- `requestAuthorization() async`
- `loadLast30Days() async`
- `link(itemId: UUID, to workoutId: UUID) async`

## Dependências
- [[HealthKitService]] (ou [[MockHealthKitService]] em previews)
- [[RunWorkoutLinkStore]]
- [[PermissionGate]]

## Consumido por
- [[Profile e HealthKit Views]]

## Notas
- Janela padrão: últimos 30 dias (ajustável)
- Ordenação por `endedAt` desc
