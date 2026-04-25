---
tags: [tipo/modelo, camada/ios, dominio/infra]
tipo: modelo
camada: ios
arquivo: AthlyRunner/Models/APIModels.swift
status: implementado
created: 2026-04-24
---

# APIModels

## Propósito
DTOs `Codable` que mapeiam exatamente a resposta JSON do backend NestJS — `UserDTO`, `WorkoutDTO`, `TrainingPlanDTO`, `WeeklyGoalDTO`, `AssessmentDTO`, `IntegrationDTO`, etc.

## Por que não usar OpenAPI-gen?
- Ver [[ADR-F02 OpenAPI client gerado]]: web usa gerado; iOS mantém DTOs escritos à mão por ora
- Escrita manual permite ajustes sutis (opcionais, enums com rawValue legível)
- Custo: precisa manter paridade com schema do backend

## Modelos expostos
- `UserDTO` → equivalente a [[User]]
- `WorkoutDTO` → equivalente a [[Workout]]
- `TrainingPlanDTO` → [[TrainingPlan]]
- `WeeklyGoalDTO` → [[WeeklyGoal]]
- `AssessmentDTO` → [[Assessment]]
- `IntegrationDTO` → [[Integration]]
- `AuthResponseDTO` (user + token JWT)

## Consumido por
- [[APIClient]] (decodifica)
- Todas as ViewModels que recebem dados do backend

## Notas
- Drift com schema do backend é risco conhecido → testar em CI é item de [[Ambiguidades e Abertos]]
