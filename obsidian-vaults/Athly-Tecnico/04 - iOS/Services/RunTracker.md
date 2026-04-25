---
tags: [tipo/servico, camada/ios, dominio/corrida]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/RunTracker.swift
status: implementado
created: 2026-04-24
---

# RunTracker

## Propósito
Orquestra uma sessão de corrida ao vivo: consome [[LocationManager]] para coletar pontos, calcula distância/ritmo/splits em tempo real e alimenta o [[LiveActivityManager]] e a [[RunViewModel]].

## API pública
- `start()` / `pause()` / `resume()` / `stop()`
- `currentSession: RunSession` (@Published)
- `splits: [Split]` (@Published)
- `state: TrackingState` (idle / running / paused / finished)

## Dependências
- [[LocationManager]]
- [[LiveActivityManager]]
- `Combine` + `Timer`

## Consumido por
- [[RunViewModel]]

## Lógica
- Filtra pontos com horizontal accuracy > 20m
- Fecha split a cada 1 km
- Calcula pace como janela móvel de últimos N segundos
- Ao `stop()` → cria [[RunSession]] completa e entrega ao [[RunStore]]

## Notas
- Durante background precisa de `UIBackgroundMode: location` + audio/processing? (verificar — ver [[Ambiguidades e Abertos]])
- Auto-pausa ao detectar parada (> 30s sem movimento) — planejado, não implementado
