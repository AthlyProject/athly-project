---
tags: [camada/backend, tipo/moc]
camala: backend
tipo: moc
status: implementado
created: 2026-04-24
---

# Backend — MOC

NestJS 11 + Prisma + PostgreSQL + Gemini 2.5-flash. 13 módulos, 14 modelos, ~40 endpoints.

## Documentos principais

- [[Stack Backend]] — Tech stack, versões
- [[Módulos/]] → [[_MOC Módulos]] — 13 módulos (auth, users, workouts, etc.)
- [[Modelos Prisma/]] → [[_MOC Modelos]] — 14 tabelas (User, Workout, TrainingPlan, etc.)
- [[Enums/]] — SportType, TrainingPlanStatus, WorkoutStatus, etc.
- [[Endpoints/]] → [[_MOC Endpoints]] — ~40 REST endpoints
- [[IA e Prompts/]] → [[_MOC IA e Prompts]] — GeminiService, AiPlannerService, prompts
- [[Strava Tools|Strava Tools.md]] — 24 ferramentas de integração

## Módulos (13)

```dataview
TABLE FROM "02 - Backend/Módulos" WHERE tipo = "modulo" SORT file.name
```

## Modelos Prisma (14)

```dataview
TABLE FROM "02 - Backend/Modelos Prisma" WHERE tipo = "modelo" SORT file.name
```

## Endpoints (~40)

```dataview
TABLE metodo AS "Método", path AS "Path", modulo AS "Módulo" FROM "02 - Backend/Endpoints" WHERE tipo = "endpoint" SORT path
```

## ADRs Backend

```dataview
TABLE status FROM "02 - Backend/ADRs Backend" WHERE tipo = "adr" SORT file.name
```

---

**Comece por**: [[Stack Backend]] → [[_MOC Módulos]] → choose um módulo
