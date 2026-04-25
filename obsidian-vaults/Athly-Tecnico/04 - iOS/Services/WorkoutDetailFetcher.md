---
tags: [tipo/servico, camada/ios, dominio/treino]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/WorkoutDetailFetcher.swift
status: implementado
created: 2026-04-24
---

# WorkoutDetailFetcher

## Propósito
Busca detalhes completos de um [[Workout]] individual (inclui blocos, zonas-alvo, notas do coach IA) quando o usuário abre a tela de detalhe.

## API pública
- `fetch(workoutId: UUID) async throws -> WorkoutDetailDTO`

## Dependências
- [[APIClient]]

## Consumido por
- [[Plan Views]] (tela de detalhe)
- [[Dashboard e History]] (sheet de detalhe)

## Notas
- Separado do fetch em lote (lista da semana) porque detalhe carrega campos pesados (AI reasoning, zonas expandidas)
- Corresponde a [[GET workouts-id]]
