---
tags: [tipo/view, camada/ios, dominio/corrida]
tipo: view
camada: ios
status: implementado
created: 2026-04-24
---

# Run Views

## Propósito
Telas relacionadas a uma sessão de corrida — iniciar, acompanhar ao vivo, resumir pós-corrida.

## Views incluídas
- `RunView` (tela cheia durante corrida, com stats grandes)
- `RunSummaryView` (pós stop — mostra rota, splits, opção de vincular a workout)
- `StartRunSheet` (bottom sheet com countdown pré-start)

## ViewModel
- [[RunViewModel]]

## Dependências
- [[RunTracker]]
- [[LiveActivityManager]]
- MapKit (overlay da rota)
- [[Components reutilizáveis]]

## Comportamento
- Mantém tela ativa (`UIApplication.shared.isIdleTimerDisabled = true`) durante corrida
- Dispara Live Activity ao iniciar — ver [[Fluxo de Live Activity]]
- Botão "Descartar" pede confirmação

## Notas
- Precisa de permissão de localização (gate via [[PermissionGate]])
