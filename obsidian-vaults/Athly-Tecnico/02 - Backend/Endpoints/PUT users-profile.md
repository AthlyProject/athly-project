---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: PUT
path: /users/profile
modulo: users
auth_required: true
status: implementado
created: 2026-04-24
---

# PUT /users/profile

Atualiza perfil do usuário autenticado.

## Autenticação

JwtAuthGuard (obrigatório).

## Request

```json
{
  "name": "João Silva Updated",
  "weight": 76,
  "height": 180,
  "dateOfBirth": "1990-05-15"
}
```

## Response 200

Retorna User atualizado (mesmo formato de GET /users/me).

## Possíveis erros

| Código | Erro |
|--------|------|
| 400 | Validação falha |
| 401 | Token inválido |

## DTOs relacionados

- [[User]]

## Fluxo interno

1. JwtAuthGuard + @CurrentUser()
2. Valida campos (weight > 0, etc.)
3. UsersService.updateProfile(userId, input)
4. Persiste em User
5. Retorna atualizado

---

Ver: [[users]], [[GET users-me]]
