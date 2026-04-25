---
tags: [camada/frontend, tipo/documento]
camada: frontend
tipo: documento
status: implementado
created: 2026-04-24
---

# Rotas e Guards

## ProtectedRoute

Requer: user autenticado + assessmentCompleted = true

Redirect: → /assessment ou /login

## AssessmentGuard

Requer: user autenticado + assessment NOT complete

Redirect: → /assessment

## Public routes

Sem guard:
- `/`
- `/login`
- `/register`

---

Ver: [[_MOC Frontend]], [[Auth Flow (backend + frontend + iOS)]]
