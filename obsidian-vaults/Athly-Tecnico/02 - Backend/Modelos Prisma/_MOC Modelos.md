---
tags: [camada/backend, tipo/moc]
camada: backend
tipo: moc
status: implementado
created: 2026-04-24
---

# Modelos Prisma — MOC

14 tabelas. Autenticação, treinamento, integrações, avaliação.

## Modelos

```dataview
TABLE FROM "02 - Backend/Modelos Prisma" WHERE tipo = "modelo" SORT file.name
```

## Grupos

### Autenticação (2)
- [[User]] — perfil do usuário
- [[Session]] — refresh tokens

### Treinamento (4)
- [[TrainingPlan]] — período de treino
- [[WeeklyGoal]] — objetivo semanal
- [[Workout]] — treino individual
- [[WorkoutFeedback]] — feedback pós-workout

### Integração (2)
- [[Integration]] — OAuth tokens (Strava, etc.)
- [[Equipment]] — catálogo de equipamentos
- [[UserEquipment]] — equipamentos do usuário

### Avaliação e Esforço (3)
- [[Assessment]] — baseline fitness
- [[UserEffortZone]] — zonas de esforço
- [[UserGoal]] — objetivo do usuário

### IA (3)
- [[AiReasoning]] — lógica de decisão da IA
- [[AiPlannerPromptLog]] — auditoria completa (prompt + response)
- [[WaitlistEntry]] — fila beta

---

**Diagrama**: Ver Canvas `Modelo de dados Prisma.canvas`

