---
tags: [tipo/adr, camada/ios, tema/live-activity]
tipo: adr
camada: ios
status: implementado
created: 2026-04-24
---

# ADR-I02 — Live Activities para corrida em andamento

## Status
aceito

## Contexto
Atletas treinam com o celular no bolso, relógio ou braçadeira. A tela precisa mostrar tempo decorrido, distância e pace enquanto bloqueada ou em outros apps. Push notifications são intrusivas e não refletem estado em tempo real.

## Decisão
Usar **ActivityKit** (iOS 16.1+) com target separado `AthlyRunnerLiveActivity`:
- [[AthlyRunnerAttributes]] define atributos (workoutTitle) e ContentState (elapsedSeconds, distanceMeters, paceSecondsPerKm)
- [[LiveActivityManager]] orquestra start/update/end
- Formatters: tempo `HH:mm:ss`, pace `m:ss/km`
- Aparece na Lock Screen e Dynamic Island

## Consequências

### Positivas
- UX premium: dados de corrida sempre visíveis
- Integra nativamente com Dynamic Island
- Zero custo de bateria adicional (atualizado a cada tick do timer)

### Negativas
- Requer iOS 16.1+ (corta parte da base instalada)
- Budget limitado de updates (push de Live Activity é throttled)
- Precisa testar em device real (simulador tem limitações)

### Trade-offs
- UX superior > compatibilidade com iOS 15

## Alternativas consideradas
- **Push notifications** — descartado: intrusivo, sem dados em tempo real
- **Widget comum** — descartado: não atualiza com frequência suficiente
- **Só notificação persistente** — descartado: deprecado, mesmo UX ruim

## Referências
- [[AthlyRunnerAttributes]]
- [[Fluxo de Live Activity]]
- [[LiveActivityManager]]
