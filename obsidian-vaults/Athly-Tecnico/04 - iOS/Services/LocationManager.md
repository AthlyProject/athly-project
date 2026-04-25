---
tags: [tipo/servico, camada/ios, dominio/corrida]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/LocationManager.swift
status: implementado
created: 2026-04-24
---

# LocationManager

## Propósito
Wrapper em volta de `CLLocationManager` — solicita permissão de localização em uso/always, expõe stream de `CLLocation` para o [[RunTracker]] construir a rota da corrida.

## API pública
- `requestAuthorization()`
- `startUpdating()` / `stopUpdating()`
- `locationPublisher: AnyPublisher<CLLocation, Never>`
- `authorizationStatus: CLAuthorizationStatus`

## Dependências
- `CLLocationManager`
- `Combine`

## Consumido por
- [[RunTracker]]
- [[PermissionGate]] (check inicial)

## Configuração
- `desiredAccuracy = kCLLocationAccuracyBest`
- `distanceFilter = 5m`
- `activityType = .fitness`
- `allowsBackgroundLocationUpdates = true` (com UIBackgroundMode "location")

## Notas
- Sem fallback para GPS ruim — corridas em interior ficam zeradas
- Pausa automática não implementada (usuário precisa pausar manualmente no [[RunTracker]])
