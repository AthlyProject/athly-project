---
tags: [tipo/modelo, camada/ios, dominio/corrida]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/RunSession.swift
status: implementado
created: 2026-04-24
---

# RunSession

## Propósito
Representa uma corrida completa feita pelo próprio app (GPS próprio). Modelo central consumido pela [[RunViewModel]] e persistido pelo [[RunStore]].

## Campos
- `id: UUID`
- `startedAt: Date` / `endedAt: Date`
- `distanceMeters: Double`
- `durationSeconds: TimeInterval`
- `averagePace: TimeInterval` (seg/km)
- `route: [RoutePoint]`
- `splits: [Split]`
- `heartRateSamples: [HRSample]?`
- `syncedToBackend: Bool`
- `linkedWorkoutId: UUID?` → ver [[RunWorkoutLink]]

## Dependências
- [[RoutePoint]]
- [[Split]]

## Consumido por
- [[RunViewModel]]
- [[RunStore]]
- [[APIClient]] (sync)

## Notas
- `Codable` para persistir em JSON via [[RunStore]]
- `Hashable` + `Identifiable` para listas SwiftUI
