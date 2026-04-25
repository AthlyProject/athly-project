---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PATCH
path: /workouts/:id/skip
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# PATCH /workouts/:id/skip

Marca workout como pulado (rest day).

## Request

Sem body (ou vazio).

## Response 200

Retorna [[Workout]] com status = "skipped".

---

Ver: [[workouts]], [[WorkoutStatus]]
