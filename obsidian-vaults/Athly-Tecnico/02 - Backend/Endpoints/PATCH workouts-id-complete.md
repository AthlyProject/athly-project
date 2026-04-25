---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PATCH
path: /workouts/:id/complete
modulo: workouts
auth_required: true
status: implementado
created: 2026-04-24
---

# PATCH /workouts/:id/complete

Marca workout como completado.

## Request

Sem body (ou vazio).

## Response 200

Retorna [[Workout]] com status = "done".

---

Ver: [[workouts]], [[WorkoutStatus]]
