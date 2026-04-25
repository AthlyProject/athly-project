---
tags: [tipo/servico, camada/ios, dominio/corrida]
tipo: servico
camada: ios
arquivo: AthlyRunner/Services/RunStore.swift
status: implementado
created: 2026-04-24
---

# RunStore

## Propósito
Persistência local (disco) de sessões de corrida feitas pelo próprio app (GPS próprio, via [[RunTracker]]). Mantém histórico mesmo offline e sincroniza com backend depois.

## API pública
- `save(_ session: RunSession) async throws`
- `load(id: UUID) async throws -> RunSession?`
- `listAll() async throws -> [RunSession]`
- `delete(id: UUID) async throws`
- `markSynced(id: UUID)`

## Armazenamento
- JSON em `Documents/runs/<id>.json` (um arquivo por corrida)
- Metadados em plist/UserDefaults para índice rápido

## Dependências
- `FileManager`
- `JSONEncoder/Decoder`

## Consumido por
- [[RunViewModel]] (após stop)
- [[HistoryPage]] iOS (listagem)
- [[APIClient]] (sync para backend)

## Notas
- Sem Core Data / SwiftData — decisão deliberada pela simplicidade e controle sobre o JSON shape
- Sync: marca `synced = true` após POST bem sucedido ao backend
