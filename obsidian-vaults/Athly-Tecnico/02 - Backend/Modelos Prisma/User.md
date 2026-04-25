---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: User

Perfil do usuário. Dados pessoais, autenticação, role.

## Propósito

Armazenar user account + metadata.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| email | String | false | unique |
| password | String | false | bcrypt hash |
| name | String | true | nome completo |
| role | RoleEnum | false | STANDARD, PREMIUM, ADMIN |
| dateOfBirth | DateTime | true | dd/mm/yyyy |
| weight | Float | true | kg |
| height | Float | true | cm |
| assessmentCompleted | Boolean | false | default: false |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- 1:N Session — refresh tokens
- 1:N TrainingPlan
- 1:N WeeklyGoal
- 1:N Workout
- 1:N WorkoutFeedback
- 1:N UserEquipment
- 1:N UserEffortZone
- 1:N Assessment
- 1:N Integration
- 1:N UserGoal
- 1:N AiReasoning
- 1:N AiPlannerPromptLog
- 1:N WaitlistEntry (optional)

## Enums relacionados

- [[RoleEnum]] — STANDARD, PREMIUM, ADMIN

## Usado em

- [[POST auth-register]] → cria User
- [[GET users-me]] → retorna User
- [[PUT users-profile]] → atualiza User

## Notas

- Password nunca é retornado em respostas (omitir)
- Role determina features disponíveis (PREMIUM → features beta)
- assessmentCompleted = gate para /app/* (protegidas)

---

Ver: [[_MOC Modelos]], [[auth]]
