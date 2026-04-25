---
tags: [tipo/adr, camada/ios, tema/arquitetura]
tipo: adr
camada: ios
status: implementado
created: 2026-04-24
---

# ADR-I01 — SwiftUI + MVVM como arquitetura base

## Status
aceito

## Contexto
O app iOS Athly Runner começou do zero em 2025. Precisava suportar Live Activities (iOS 16.1+), HealthKit, GPS em tempo real, reatividade fluida em corridas.

## Decisão
**SwiftUI** como UI layer primária, com UIKit apenas para configuração global (`UINavigationBarAppearance`, `UITabBarAppearance` em `AppDelegate`). Arquitetura **MVVM** com:
- `@MainActor` + `@Published` nos ViewModels
- `async/await` para operações assíncronas
- Combine para fluxos reativos pontuais (ex: tokens refreshed)
- Binding declarativo View ↔ ViewModel

## Consequências

### Positivas
- Reatividade nativa, zero boilerplate de RxSwift
- Preview em tempo real acelera iteração
- Live Activities suporta SwiftUI nativamente
- Menos glue code que UIKit + MVC

### Negativas
- iOS 15 é piso prático (alguns APIs precisam 16+)
- Animações complexas exigem trabalho extra comparado a UIKit
- Alguns bugs sutis de ciclo de vida em SwiftUI inicial

### Trade-offs
- Modernidade e produtividade > compatibilidade com iOS antigos

## Alternativas consideradas
- **UIKit + MVC** — descartado: boilerplate alto, menos alinhado com Live Activities
- **SwiftUI + TCA** — descartado: overkill para o escopo; curva alta
- **SwiftUI + Redux** — descartado: idem

## Referências
- [[_MOC iOS]]
- [[Stack iOS]]
- [[AuthViewModel]]
- [[RunViewModel]]
