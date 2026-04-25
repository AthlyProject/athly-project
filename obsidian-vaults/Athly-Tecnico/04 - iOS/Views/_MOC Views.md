---
tags: [tipo/moc, camada/ios]
tipo: moc
camada: ios
created: 2026-04-24
---

# MOC — Views iOS

Índice das agrupamentos de Views (SwiftUI) do AthlyRunner.

## Autenticação
- [[Auth Views]] — Login, Registro, Reset de senha

## Corrida ao vivo
- [[Run Views]] — tela de corrida + detalhe de [[RunSession]]

## Plano de treino
- [[Plan Views]] — plano atual, semana, detalhe de [[Workout]]

## Dashboard e histórico
- [[Dashboard e History]] — home e histórico consolidado

## Perfil e integrações
- [[Profile e HealthKit Views]] — perfil, HealthKit, Strava, permissões

## Componentes
- [[Components reutilizáveis]] — cards, badges, empty states

## Raiz
- [[Root e MainTab]] — ContentView, TabView, AuthGate

```dataview
TABLE camada, status
FROM "04 - iOS/Views"
WHERE tipo = "view"
SORT file.name ASC
```
