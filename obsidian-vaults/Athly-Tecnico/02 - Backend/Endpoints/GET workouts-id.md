---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /workouts/:id
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /workouts/:id

Retorna detalhe de um workout específico.

## Autenticação

JwtAuthGuard (obrigatório).

## Response 200

Retorna [[Workout]] completo com blocks JSON.

---

Ver: [[workouts]], [[GET workouts-today]]
