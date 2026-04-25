---
tags: [tipo/servico, camada/ios, dominio/healthkit]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/HealthKitService.swift
status: implementado
created: 2026-04-24
---

# HealthKitService

## Propósito
Lê workouts de corrida do HealthKit (Apple Watch, outros apps) para exibir na [[HealthKitRunsViewModel]] e permitir vínculo com [[Workout]] via [[RunWorkoutLinkStore]].

## API pública
- `requestAuthorization() async throws`
- `fetchRunningWorkouts(from: Date, to: Date) async throws -> [HealthKitRunItem]`
- `fetchRoute(for: HKWorkout) async throws -> [CLLocation]`
- `fetchHeartRateSamples(for: HKWorkout) async throws -> [HKQuantitySample]`

## Dependências
- `HealthKit` framework
- Entitlement `com.apple.developer.healthkit`
- Info.plist: `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`

## Consumido por
- [[HealthKitRunsViewModel]]
- [[PermissionGate]]

## Tipos lidos
- `HKWorkoutType` (running)
- `HKQuantityType` distance, energy, heart rate
- `HKWorkoutRoute`

## Notas
- Só leitura — não escreve no HealthKit (corridas com GPS próprio do app ficam em [[RunStore]] local, não são salvas no HK)
- Mock: [[MockHealthKitService]] para previews/simulador
- Ver [[ADR-I03 HealthKit integration]]
