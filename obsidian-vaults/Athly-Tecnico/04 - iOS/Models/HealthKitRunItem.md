---
tags: [tipo/modelo, camada/ios, dominio/healthkit]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/HealthKitRunItem.swift
status: implementado
created: 2026-04-24
---

# HealthKitRunItem

## Propósito
Representação normalizada de um `HKWorkout` de corrida vindo do HealthKit, pronta para exibição e vínculo com um [[Workout]] planejado.

## Campos
- `id: UUID` (local, gerado)
- `hkWorkoutUUID: UUID` (do HKWorkout)
- `startedAt: Date` / `endedAt: Date`
- `distanceMeters: Double`
- `durationSeconds: TimeInterval`
- `averagePace: TimeInterval?`
- `source: String` (nome do app/device que gravou)
- `route: [RoutePoint]?` (se disponível)
- `averageHeartRate: Double?`
- `linkedWorkoutId: UUID?`

## Dependências
- [[RoutePoint]]

## Consumido por
- [[HealthKitService]] (retorna)
- [[HealthKitRunsViewModel]]
- [[RunWorkoutLinkStore]]

## Notas
- Diferente de [[RunSession]] (que é do próprio app) — HealthKitRunItem é _leitura_, read-only
- `route` só existe quando o app gravador expôs `HKWorkoutRoute`
