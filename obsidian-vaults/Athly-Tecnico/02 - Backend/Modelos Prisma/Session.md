---
tags: [camada/backend, tipo/modelo]
camala: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: Session

Refresh tokens para autenticação stateful.

## Propósito

Armazenar refresh tokens (1 por login) para renovação de JWT access.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| refreshToken | String | false | refresh token (hash?) |
| expiresAt | DateTime | false | validade |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User

## Usado em

- [[POST auth-login]] → cria Session
- Token refresh → valida expiresAt

## Notas

- Sem índice único (usuário pode ter múltiplas sessões simultâneas)
- Limpar sesões expiradas: job cron
- Logout: DELETE session (frontend remove localStorage também)

---

Ver: [[User]], [[auth]]
