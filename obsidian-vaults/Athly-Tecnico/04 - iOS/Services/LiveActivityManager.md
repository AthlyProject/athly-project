---
tags: [tipo/servico, camada/ios, dominio/corrida]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/LiveActivityManager.swift
status: implementado
created: 2026-04-24
---

# LiveActivityManager

## Propósito
Inicia, atualiza e encerra Live Activities (Dynamic Island + Lock Screen) durante uma corrida. Reflete distância, tempo, ritmo e split atual em tempo real via ActivityKit.

## API pública
- `start(with initial: AthlyRunnerAttributes.ContentState)`
- `update(_ state: AthlyRunnerAttributes.ContentState)`
- `end(finalState: AthlyRunnerAttributes.ContentState?)`

## Dependências
- `ActivityKit` (iOS 16.1+)
- [[AthlyRunnerAttributes]]
- Target separado: `AthlyRunnerLiveActivity` (Widget Extension)

## Consumido por
- [[RunTracker]] (dispara updates a cada N segundos)
- [[RunViewModel]]

## Fluxo
1. Usuário toca "Iniciar corrida" → [[RunTracker]] `.start()`
2. `LiveActivityManager.start(...)` → Live Activity aparece
3. A cada update do [[RunTracker]], `.update(...)` refresca stats
4. `.stop()` → `.end(...)` encerra Live Activity com estado final

## Notas
- Ver [[ADR-I02 Live Activities para corrida]]
- Fluxo completo documentado em [[Fluxo de Live Activity]]
- Budget de updates do iOS é limitado — spam de updates é dropado silenciosamente
