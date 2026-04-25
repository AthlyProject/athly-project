---
tags: [tipo/modelo, camada/ios, dominio/corrida]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/Split.swift
status: implementado
created: 2026-04-24
---

# Split

## Propósito
Um split (parcial) de 1 km dentro de uma [[RunSession]]. Usado na UI de detalhe para mostrar ritmo por km.

## Campos
- `index: Int` (1, 2, 3...)
- `distanceMeters: Double` (normalmente 1000, último pode ser < 1000)
- `durationSeconds: TimeInterval`
- `pace: TimeInterval` (seg/km)
- `averageHeartRate: Double?`

## Consumido por
- [[RunSession]]
- [[RunTracker]] (gera ao cruzar cada km)
- Views de detalhe de corrida

## Notas
- `Codable`, `Identifiable` por `index`
- Último split pode ser parcial se usuário parou antes do km cheio
