---
tags: [tipo/view, camada/ios, dominio/infra]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Root e MainTab

## Propósito
Entry point da UI do app. Decide se mostra fluxo autenticado (`MainTabView`) ou não autenticado ([[Auth Views]]).

## Views incluídas
- `AthlyRunnerApp` (struct `App`)
- `ContentView` (root — faz auth gate)
- `MainTabView` (TabView com as tabs principais)
- `SplashView` (brief splash enquanto `loadPersistedSession` roda)

## Tabs
1. **Hoje** → [[Dashboard e History]] (DashboardView)
2. **Plano** → [[Plan Views]]
3. **Correr** → [[Run Views]] (StartRunSheet como entry)
4. **Histórico** → [[Dashboard e History]] (HistoryView)
5. **Perfil** → [[Profile e HealthKit Views]]

## Dependências
- [[AuthViewModel]] (EnvironmentObject global)

## Notas
- `@main` struct registra `AuthViewModel()` como `@StateObject` e injeta no ambiente
- ContentView observa `authViewModel.isAuthenticated` e troca o conteúdo
