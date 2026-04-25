---
tags: [tipo/viewmodel, camada/ios, dominio/corrida]
tipo: viewmodel
camada: ios
arquivo: AthlyRunner/ViewModels/RunViewModel.swift
status: implementado
created: 2026-04-24
---

# RunViewModel

## Propósito
ViewModel da tela de corrida ao vivo — orquestra [[RunTracker]], [[LiveActivityManager]] e persistência via [[RunStore]]. Expõe stats em tempo real para [[Run Views]].

## Estado exposto
- `@Published var elapsed: TimeInterval`
- `@Published var distance: Double`
- `@Published var pace: TimeInterval`
- `@Published var currentSplit: Split?`
- `@Published var trackingState: TrackingState`
- `@Published var lastSavedSession: RunSession?`

## Ações
- `start()` / `pause()` / `resume()` / `finish()`
- `discard()` (descartar sessão em andamento sem salvar)
- `linkToWorkout(workoutId: UUID)` → [[RunWorkoutLinkStore]]

## Dependências
- [[RunTracker]]
- [[LiveActivityManager]]
- [[RunStore]]
- [[PermissionGate]]
- [[APIClient]] (sync)

## Consumido por
- [[Run Views]]

## Notas
- Ver [[ADR-I01 SwiftUI + MVVM]] + [[ADR-I02 Live Activities para corrida]]
- Gate de permissão via [[PermissionGate]] antes de iniciar
