---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: UserGoal

Objetivo específico do usuário (maratona, 10k, triathlon, etc.).

## Propósito

Armazenar meta running-related com target metrics e event date.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| title | String | false | "Maratona SP 2026" |
| description | String | true | contexto livre |
| targetDistance | Float | true | km (ex: 42.2 para maratona) |
| targetTime | String | true | hh:mm (ex: "3:45:00") |
| eventDate | DateTime | true | data alvo |
| eventName | String | true | "Maratona SP" |
| status | String | false | "active", "completed", "abandoned" |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- N:1 User

## Usado em

- [[POST goals]] (com parsing via goal-parser-prompt)
- [[GET goals]]
- [[AiPlannerService]] → input principal

## Notas

- Parsed por Gemini (goal-parser-prompt) para extrair fields
- Múltiplos goals simultâneos possível
- Informa geração de planos

---

Ver: [[goals]], [[Goal Parser Prompt]], [[User]], [[_MOC Modelos]]
