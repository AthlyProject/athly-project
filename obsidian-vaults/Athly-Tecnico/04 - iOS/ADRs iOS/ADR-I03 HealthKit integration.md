---
tags: [tipo/adr, camada/ios, tema/healthkit]
tipo: adr
camada: ios
status: implementado
created: 2026-04-24
---

# ADR-I03 — Integração com HealthKit

## Status
aceito

## Contexto
Usuários do iOS frequentemente têm histórico de corridas no Apple Health (de outros apps ou Apple Watch). Além disso, ao terminar uma corrida no Athly, o treino deve aparecer no Health para fechar o loop com o resto do ecossistema.

## Decisão
Usar **HealthKit** via [[HealthKitService]] com abstração por protocolo `HealthKitRunningWorkoutsProviding` (permitindo [[MockHealthKitService]] no simulador).

Tipos capturados:
- `HKQuantityType(.distanceWalkingRunning)` — distância
- `HKQuantityType(.activeEnergyBurned)` — calorias
- `HKWorkoutType` — treinos completos

Operações:
- Leitura: histórico de corridas (`fetchLatestRunningWorkouts(limit:)`)
- Escrita: gravar treino ao final da corrida
- Autorização versionada via [[PermissionGate]] (keys tipo `healthkit.read.requested.v1`) para não re-pedir permissões

## Consequências

### Positivas
- Integração nativa com ecossistema Apple
- Histórico de outros apps visível no Athly
- Treinos fechados aparecem no Health → Apple Watch/anéis

### Negativas
- Permissões granulares — usuário pode negar parte
- Simulador não tem Health real → mock obrigatório
- UUID de workout salvo precisa ser rastreado (`lastSavedHealthKitUUID`)

### Trade-offs
- Dependência fechada no ecossistema Apple > portabilidade

## Alternativas consideradas
- **Sem HealthKit** — descartado: perde histórico rico; experiência não-Apple
- **Strava apenas** — parcial: Strava é backend, HealthKit é dispositivo; são complementares

## Referências
- [[HealthKitService]]
- [[PermissionGate]]
- [[MockHealthKitService]]
- [[HealthKitRunsViewModel]]
