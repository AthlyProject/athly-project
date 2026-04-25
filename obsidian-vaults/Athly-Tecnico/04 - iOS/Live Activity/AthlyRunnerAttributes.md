---
tags: [tipo/modelo, camada/ios, dominio/corrida]
tipo: modelo
camada: ios
arquivo: AthlyRunnerLiveActivity/AthlyRunnerAttributes.swift
status: implementado
created: 2026-04-24
---

# AthlyRunnerAttributes

## Propósito
`ActivityAttributes` que descreve o payload da Live Activity de corrida. Compartilhado entre o app principal (que atualiza) e o Widget Extension (que renderiza Dynamic Island / Lock Screen).

## Estrutura
```swift
struct AthlyRunnerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsed: TimeInterval
        var distance: Double        // metros
        var pace: TimeInterval      // seg/km
        var splitIndex: Int
        var isPaused: Bool
    }

    var workoutTitle: String?       // ex: "5x1km tempo"
    var startedAt: Date
}
```

## Consumido por
- [[LiveActivityManager]] (atualiza `ContentState`)
- Widget Extension `AthlyRunnerLiveActivity` (renderiza UI)

## Notas
- `Codable` é obrigatório (ActivityKit serializa para o sistema)
- Payload precisa ser pequeno — detalhes mais pesados ficam em [[RunSession]] do app
- Ver [[ADR-I02 Live Activities para corrida]] e [[Fluxo de Live Activity]]
