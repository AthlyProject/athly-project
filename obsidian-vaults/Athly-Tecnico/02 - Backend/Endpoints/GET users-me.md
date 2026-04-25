---
tags: [camada/backend, tipo/endpoint]
camala: backend
tipo: endpoint
metodo: GET
path: /users/me
modulo: users
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /users/me

Retorna perfil do usuário autenticado.

## Autenticação

JwtAuthGuard (Bearer token obrigatório).

## Request

Sem body. Header:
```
Authorization: Bearer {access_token}
```

## Response 200

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "João Silva",
  "role": "STANDARD",
  "dateOfBirth": "1990-05-15",
  "weight": 75.5,
  "height": 180,
  "assessmentCompleted": true,
  "createdAt": "2026-04-24T10:00:00Z"
}
```

## Possíveis erros

| Código | Erro |
|--------|------|
| 401 | Token inválido ou expirado |
| 500 | Erro interno |

## DTOs relacionados

- [[User]] — modelo retornado

## Fluxo interno

1. JwtAuthGuard valida token
2. @CurrentUser() extrai userId
3. UsersService.getMe(userId)
4. Retorna User completo (sem password)

---

Ver: [[users]], [[GET users-me]]
