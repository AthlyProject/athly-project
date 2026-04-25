---
tags: [tipo/modelo, camada/ios, dominio/corrida]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/RoutePoint.swift
status: implementado
created: 2026-04-24
---

# RoutePoint

## Propósito
Ponto GPS individual dentro da rota de uma [[RunSession]]. Armazenado em array serializado.

## Campos
- `timestamp: Date`
- `latitude: Double`
- `longitude: Double`
- `altitude: Double?`
- `horizontalAccuracy: Double`
- `speed: Double?` (m/s)

## Consumido por
- [[RunSession]]
- [[RunTracker]] (gera)
- Views de mapa (MapKit overlay)

## Notas
- `Codable` para serialização compacta
- Equivalente simplificado de `CLLocation`, desacoplado do framework CoreLocation para facilitar testes
