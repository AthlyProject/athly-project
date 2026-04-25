---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /auth/login
modulo: auth
auth_required: false
status: implementado
created: 2026-04-24
---

# POST /auth/login

Login com email e senha.

## Autenticação

Sem autenticação (público).

## Request

```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

## Response 200

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "João Silva",
    "role": "STANDARD",
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
| 400 | Email/senha inválidos |
| 500 | Erro interno |

## DTOs relacionados

- [[User]] — usuário retornado
- [[Session]] — refresh token armazenado

## Fluxo interno

1. Valida formato email
2. Fetch User por email
3. Compara password (bcrypt)
4. Gera JWT access (1h)
5. Cria Session com refresh token
6. Retorna resposta

## Notas

- Refresh token pode ser armazenado em localStorage (web) ou Keychain (iOS)
- Bearer no header: `Authorization: Bearer {access_token}`

---

Ver: [[auth]], [[POST auth-register]], [[Auth Flow (backend + frontend + iOS)]]
