---
tags: [tipo/viewmodel, camada/ios, dominio/auth]
tipo: viewmodel
camada: ios
arquivo: AthlyRunner/ViewModels/AuthViewModel.swift
status: implementado
created: 2026-04-24
---

# AuthViewModel

## Propósito
Gerencia login, registro, logout e estado de autenticação do app iOS. Armazena o JWT em Keychain e disponibiliza o token para o [[APIClient]].

## Estado exposto
- `@Published var currentUser: UserDTO?`
- `@Published var isAuthenticated: Bool`
- `@Published var isLoading: Bool`
- `@Published var errorMessage: String?`

## Ações
- `login(email, password) async`
- `register(...) async`
- `logout()`
- `loadPersistedSession()` (chamado no app launch)

## Dependências
- [[APIClient]]
- Keychain (via `Security` framework)
- [[APIModels]] (UserDTO, AuthResponseDTO)

## Consumido por
- [[Auth Views]]
- [[Root e MainTab]]
- Praticamente todo o app (via EnvironmentObject)

## Notas
- Ver [[ADR-I01 SwiftUI + MVVM]]
- Logout limpa Keychain + [[TrainingPlanCache]]
