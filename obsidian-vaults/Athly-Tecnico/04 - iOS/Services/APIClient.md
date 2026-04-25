---
tags: [tipo/servico, camada/ios, dominio/infra]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/APIClient.swift
status: implementado
created: 2026-04-24
---

# APIClient

## Propósito
Cliente HTTP central do app iOS. Faz requests autenticados ao backend NestJS, adicionando o JWT do [[AuthViewModel]] via `Authorization: Bearer`.

## API pública
- `get<T: Decodable>(path) async throws -> T`
- `post<T: Decodable, B: Encodable>(path, body) async throws -> T`
- `put<T: Decodable, B: Encodable>(path, body) async throws -> T`
- `delete(path) async throws`

## Dependências
- `URLSession.shared`
- JWT token injetado pelo [[AuthViewModel]]

## Consumido por
- [[AuthViewModel]]
- [[TrainingPlanViewModel]]
- [[RunViewModel]] (sync de corridas)
- [[WorkoutDetailFetcher]]
- [[RunWorkoutLinkStore]]

## Tratamento de erros
- 401 → dispara logout no [[AuthViewModel]]
- 4xx / 5xx → lança `APIError` tipado
- Erros de rede → propagados para a View mostrar fallback

## Notas
- Sem SDK gerado (diferente do frontend web que usa [[ADR-F02 OpenAPI client gerado]])
- Refatoração para actor/session isolada está planejada
- Relacionado a [[ADR-I01 SwiftUI + MVVM]]
