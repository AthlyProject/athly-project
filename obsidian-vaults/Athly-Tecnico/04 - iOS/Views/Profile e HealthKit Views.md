---
tags: [tipo/view, camada/ios, dominio/usuario]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Profile e HealthKit Views

## Propósito
Telas de perfil do usuário, integrações (Strava, HealthKit) e gestão de permissões.

## Views incluídas
- `ProfileView` (dados pessoais, peso, altura, objetivos)
- `IntegrationsView` (lista de integrações: Strava, HealthKit)
- `HealthKitRunsView` (lista de corridas HealthKit com vínculo)
- `PermissionsView` (estado de cada permissão)
- `SettingsView` (logout, sobre, versão)

## ViewModels usados
- [[AuthViewModel]] (profile + logout)
- [[HealthKitRunsViewModel]]
- [[PermissionGate]]

## Dependências
- [[APIClient]] (atualizar profile)
- [[Components reutilizáveis]]

## Fluxo Strava
1. User toca "Conectar Strava" em IntegrationsView
2. Abre Safari/ASWebAuthenticationSession
3. OAuth callback → backend troca code por token
4. App recebe resposta → exibe "Conectado"

## Notas
- Ver [[ADR-I03 HealthKit integration]]
- Strava OAuth ainda não 100% implementado no iOS — placeholder
