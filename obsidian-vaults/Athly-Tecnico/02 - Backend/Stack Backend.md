---
tags: [camada/backend, tipo/documento]
camada: backend
tipo: documento
status: implementado
created: 2026-04-24
---

# Stack Backend

## Versões

| Componente | Versão | Notas |
|-----------|--------|-------|
| NestJS | 11.0.1 | Framework principal |
| TypeScript | 5.7.3 | Linguagem |
| Prisma | 7.3.0 | ORM |
| PostgreSQL | 14+ | Database |
| Passport | 11+ | Auth strategy |
| JWT | standard | Access + Refresh tokens |
| bcrypt | 5.1+ | Password hashing |
| @google/generative-ai | 0.24.1 | Gemini 2.5-flash |
| class-validator | 0.14+ | DTO validation |
| @nestjs/swagger | 7+ | API docs |

## Arquitetura

```
src/
├── main.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/ (jwt, local)
│   │   ├── guards/ (jwt.guard, auth.guard)
│   │   ├── dto/ (LoginInput, RegisterInput)
│   │   └── auth.module.ts
│   ├── users/ (GET /me, PUT /profile, etc.)
│   ├── workouts/ (CRUD + feedback + status)
│   ├── training-plans/ (CRUD)
│   ├── weekly-goals/ (CRUD)
│   ├── equipments/ (CRUD)
│   ├── ai-planner/ (orquestração IA)
│   ├── integrations/ (Strava, etc.)
│   ├── strava/ (24 tools)
│   ├── assessment/ (eval inicial)
│   ├── effort-zones/ (zonas de esforço)
│   ├── goals/ (user goals)
│   └── waitlist/ (beta)
├── services/
│   ├── gemini.service.ts
│   ├── strava.service.ts
│   └── ...
├── guards/
│   ├── jwt.guard.ts
│   └── auth.guard.ts
├── decorators/
│   └── @CurrentUser() (extrai user do JWT)
└── prisma/ (schema + migrations)
```

## Enums principais

- **SportType**: running, cycling, swimming, strength, crossfit, triathlon, duathlon, yoga, walking, other
- **TrainingPlanStatus**: ACTIVE, COMPLETED, CANCELLED, LOCKED, DRAFT
- **WorkoutStatus**: scheduled, done, skipped, partial
- **IntegrationType**: strava, garmin, apple_health, other
- **RoleEnum**: STANDARD, PREMIUM, ADMIN
- **WeeklyGoalStatus**: PLANNED, GENERATED, CANCELLED, LOCKED

Ver: [[Enums/]]

## Modelos Prisma (14)

1. **User** — perfil, role, date de nascimento, peso, altura
2. **Session** — refresh tokens (1 por login)
3. **TrainingPlan** — plano de treino (status, datas)
4. **WeeklyGoal** — objetivo semanal (7 workouts)
5. **Workout** — treino individual (blocks JSON, status)
6. **WorkoutFeedback** — feedback pós-workout (rating, notes)
7. **Integration** — Strava/Garmin/etc.
8. **Equipment** — equipamentos disponíveis
9. **UserEquipment** — equipamentos do usuário
10. **UserEffortZone** — zonas de esforço customizadas
11. **Assessment** — avaliação inicial (5 sessões)
12. **UserGoal** — objetivo do usuário
13. **AiReasoning** — reasoning da IA (audit)
14. **AiPlannerPromptLog** — log completo (prompt + response)
15. **WaitlistEntry** — fila beta

Ver: [[_MOC Modelos]]

## REST Endpoints (~40)

Agrupados por rota:
- `/auth` — login, register
- `/users` — me, profile
- `/workouts` — CRUD, feedback, status
- `/training-plans` — CRUD
- `/weekly-goals` — CRUD
- `/equipments` — CRUD
- `/ai-planner` — plan-next-week, plan-from-health
- `/integrations` — connect, disconnect
- `/assessment` — GET, POST
- `/goals` — CRUD
- `/waitlist` — POST

Ver: [[_MOC Endpoints]]

## IA & Prompts

- **GeminiService**: wrapper @google/generative-ai
- **AiPlannerService**: orquestração (UserGoal + Assessment + Strava + EffortZones → Gemini → 7 Workouts)
- **Planner Prompt v3.0**: prompt principal
- **goal-parser-prompt**: valida goal running-related
- **Assessment prompt**: 5 sessões genéricas

Ver: [[_MOC IA e Prompts]]

## Strava Tools (24)

- connectStrava, getRecentActivities, getAllActivities, getActivityDetails, getActivityLaps, getActivityPhotos, getActivityStreams
- getAthleteProfile, getAthleteStats, getAthleteZones, listAthleteClubs, listAthleteRoutes, getRoute
- getSegment, getSegmentEffort, listSegmentEfforts, listStarredSegments, starSegment
- exploreSegments, exportRouteGpx, exportRouteTcx, getServerVersion, planNextWeek, formatWorkoutFile

Ver: [[Strava Tools]]

---

**Comece por**: [[_MOC Módulos]] ou escolha um [[Endpoints/|endpoint]]
