---
tags: [camada/backend, tipo/moc]
camada: backend
tipo: moc
status: implementado
created: 2026-04-24
---

# Endpoints REST — MOC

~40 endpoints agrupados por rota. Documentação por endpoint em YAML/Swagger.

## Por módulo

```dataview
TABLE metodo AS "Método", path AS "Path", modulo AS "Módulo" FROM "02 - Backend/Endpoints" WHERE tipo = "endpoint" SORT path
```

## Grupos

### Auth (2)
- [[POST auth-login]]
- [[POST auth-register]]

### Users (2)
- [[GET users-me]]
- [[PUT users-profile]]

### Workouts (9)
- [[GET workouts-today]]
- [[GET workouts-id]]
- [[GET workouts-history]]
- [[GET workouts-training-plan]]
- [[POST workouts]]
- [[PUT workouts-id]]
- [[POST workouts-id-feedback]]
- [[PATCH workouts-id-complete]]
- [[PATCH workouts-id-skip]]

### Training Plans (5)
- [[GET training-plans-me]]
- [[GET training-plans-id]]
- [[POST training-plans]]
- [[PUT training-plans-id]]
- [[DELETE training-plans-id]]

### Weekly Goals (5)
- [[GET weekly-goals-training-plan]]
- [[GET weekly-goals-uuid]]
- [[POST weekly-goals]]
- [[PUT weekly-goals-uuid]]
- [[DELETE weekly-goals-uuid]]

### AI Planner (2)
- [[POST ai-planner-plan-next-week]]
- [[POST ai-planner-plan-from-health]]

### Integrations (3)
- [[GET integrations]]
- [[POST integrations-id-connect]]
- [[DELETE integrations-id-disconnect]]

### Assessment (2)
- [[GET assessment]]
- [[POST assessment]]

### Equipment (7)
- GET /equipments
- GET /equipments/my-equipments
- GET /equipments/:uuid
- POST /equipments
- PUT /equipments/:uuid
- DELETE /equipments/:uuid
- POST /equipments/:equipmentId/add
- DELETE /equipments/:equipmentId/remove

### Goals (3)
- [[GET goals]]
- [[POST goals]]
- [[PUT goals-id]]

### Waitlist (1)
- [[POST waitlist]]

---

**Cada endpoint tem**: Autenticação, Request/Response examples, Erros, DTOs, Fluxo interno.
