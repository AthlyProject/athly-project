---
tags: [tipo/servico, camada/ios, dominio/corrida]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/RunWorkoutLinkStore.swift
status: implementado
created: 2026-04-24
---

# RunWorkoutLinkStore

## Propósito
Mantém a associação entre uma corrida feita (GPS próprio via [[RunStore]] ou HealthKit via [[HealthKitService]]) e o [[Workout]] planejado correspondente, permitindo ao usuário marcar "isto foi o tempo 5x1km de terça".

## API pública
- `link(runId: UUID, workoutId: UUID) async throws`
- `unlink(runId: UUID) async throws`
- `linkedWorkout(for runId: UUID) -> UUID?`
- `linkedRun(for workoutId: UUID) -> UUID?`

## Armazenamento
- Persistido local + sincronizado com backend via [[APIClient]]
- Fonte da verdade: backend (local é cache)

## Dependências
- [[APIClient]]
- [[RunStore]]
- [[RunWorkoutLink]]

## Consumido por
- [[RunViewModel]]
- [[HealthKitRunsViewModel]]

## Notas
- Um workout só pode ter uma corrida vinculada (1:1)
- Se tentar vincular outro run → sobrescreve (com confirmação na UI)
