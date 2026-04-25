---
tags: [tipo/modelo, camada/ios, dominio/corrida]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/RunWorkoutLink.swift
status: implementado
created: 2026-04-24
---

# RunWorkoutLink

## Propósito
Modelo que representa o vínculo entre uma corrida executada (seja [[RunSession]] do app ou [[HealthKitRunItem]]) e um [[Workout]] planejado pelo backend.

## Campos
- `id: UUID`
- `workoutId: UUID` (do backend)
- `runId: UUID` (local: RunSession.id ou HealthKitRunItem.id)
- `runSource: RunSource` (app / healthkit)
- `createdAt: Date`

## Enum RunSource
- `app` → veio de [[RunSession]]
- `healthkit` → veio de [[HealthKitRunItem]]

## Consumido por
- [[RunWorkoutLinkStore]]

## Notas
- Persistido local + sync com backend (endpoint correspondente no backend: TBD)
- Único por `workoutId` (1:1)
