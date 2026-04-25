---
tags: [tipo/servico, camada/ios, dominio/infra]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/PermissionGate.swift
status: implementado
created: 2026-04-24
---

# PermissionGate

## Propósito
Centraliza checagem e solicitação de todas as permissões críticas do app: localização (sempre/uso), HealthKit, notificações, motion/fitness.

## API pública
- `checkAll() -> PermissionStatus`
- `requestLocationIfNeeded() async`
- `requestHealthKitIfNeeded() async throws`
- `requestNotificationsIfNeeded() async`

## Dependências
- [[LocationManager]]
- [[HealthKitService]]
- `UNUserNotificationCenter`

## Consumido por
- Views de onboarding (pede todas de uma vez)
- [[RunViewModel]] (gate antes de iniciar corrida)
- [[HealthKitRunsViewModel]]

## Notas
- Mostra sheet explicativo ANTES de disparar diálogo do sistema (padrão Apple: "priming")
- Estado compartilhado via @Published para Views reagirem a mudanças
