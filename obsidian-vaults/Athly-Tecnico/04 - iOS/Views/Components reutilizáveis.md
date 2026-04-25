---
tags: [tipo/view, camada/ios, dominio/design-system]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Components reutilizáveis

## Propósito
Biblioteca interna de componentes SwiftUI reutilizados em múltiplas Views. Define a "cara" visual do app iOS, alinhada (mas não idêntica) ao [[ADR-F01 Design System raposa neon]] do web.

## Componentes
- `PrimaryButton` / `SecondaryButton`
- `WorkoutCard` (usado em [[Plan Views]] e [[Dashboard e History]])
- `StatTile` (grande número + label — para [[Run Views]])
- `ZoneBadge` (exibe zona de esforço com cor)
- `EmptyStateView` (fallback visual)
- `LoadingIndicator`
- `SectionHeader`
- `Sheet wrappers` (detent presets)

## Design tokens
- Cores: dark mode first (fundo #0A0A0A, verde neon #39FF14 como accent)
- Tipografia: SF Rounded para títulos, SF Pro para corpo
- Spacing: 4-8-12-16-24-32

## Consumido por
- [[Auth Views]]
- [[Run Views]]
- [[Plan Views]]
- [[Dashboard e History]]
- [[Profile e HealthKit Views]]

## Notas
- Sem lib externa — tudo puro SwiftUI (alinhado com [[ADR-I01 SwiftUI + MVVM]] "zero deps")
