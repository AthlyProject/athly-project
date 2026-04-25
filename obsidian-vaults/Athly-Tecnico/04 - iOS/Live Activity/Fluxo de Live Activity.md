---
tags: [tipo/fluxo, camada/ios, dominio/corrida]
tipo: fluxo
camada: ios
status: implementado
created: 2026-04-24
---

# Fluxo de Live Activity

Sequência end-to-end do ciclo de vida de uma Live Activity de corrida.

## Pré-condições
- iOS 16.1+
- Live Activities habilitadas em Settings → AthlyRunner
- Permissão de localização concedida (ver [[PermissionGate]])

## Fluxo

### 1. Start
1. User toca "Iniciar" em [[Run Views]] (StartRunSheet)
2. [[RunViewModel]] chama `runTracker.start()`
3. [[RunTracker]] começa a coletar pontos via [[LocationManager]]
4. [[RunTracker]] chama `liveActivityManager.start(with: initialState)`
5. [[LiveActivityManager]] faz `Activity<AthlyRunnerAttributes>.request(...)` → Live Activity aparece no Dynamic Island + Lock Screen

### 2. Update (loop)
- A cada 1s (ou quando split fecha), [[RunTracker]] publica novo `ContentState`
- [[LiveActivityManager]] chama `activity.update(using:)`
- Widget re-renderiza

### 3. Pause/Resume
- User toca pausa em [[Run Views]]
- `ContentState.isPaused = true` propagado
- Widget mostra ícone de pausa + tempo congelado

### 4. End
1. User toca "Finalizar"
2. [[RunViewModel]] chama `runTracker.stop()` → gera [[RunSession]] final
3. [[LiveActivityManager]] chama `activity.end(finalState: ..., dismissalPolicy: .default)`
4. Live Activity persiste por alguns segundos com estado final e depois é removida

## Edge cases
- App matado → Live Activity continua aparecendo; updates param (budget expira)
- Background location com erro → continua Live Activity com último estado válido
- iOS derruba a atividade após ~8h → nova precisa ser iniciada

## Referências
- [[ADR-I02 Live Activities para corrida]]
- [[AthlyRunnerAttributes]]
- [[LiveActivityManager]]
