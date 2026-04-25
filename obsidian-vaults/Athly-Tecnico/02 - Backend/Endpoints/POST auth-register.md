---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /auth/register
modulo: auth
auth_required: false
status: implementado
created: 2026-04-24
---

# POST /auth/register

Registrar novo usuário.

## Autenticação

Sem autenticação (público).

## Request

```json
{
  "email": "newuser@example.com",
  "password": "senha123",
  "name": "Maria Silva",
  "dateOfBirth": "1990-05-15"
}
```

## Response 201

```json
{
  "user": {
    "id": "uuid",
    "email": "newuser@example.com",
    "name": "Maria Silva",
    "role": "STANDARD",
    "dateOfBirth": "1990-05-15",
    "assessmentCompleted": false
  },
  "access_token": "eyJhbGc...",
  "refresh_token": "abc123...",
  "expires_in": 3600
}
```

## Possíveis erros

| Código | Erro |
|--------|------|
| 400 | Email já existe ou validação falha |
| 500 | Erro interno |

## DTOs relacionados

- [[User]] — novo usuário criado
- [[Session]] — refresh token

## Fluxo interno

1. Valida email (único), password (força)
2. Hash password (bcrypt)
3. Cria User (role = STANDARD, assessmentCompleted = false)
4. Gera JWT access + Session
5. Retorna com tokens

## Notas

- Usuário novo é redirecionado para `/assessment` (frontend)
- assessmentCompleted = false até completar avaliação
- Sem acesso a /app/* até assessment completo

---

Ver: [[auth]], [[POST auth-login]], [[assessment]]
