---
tags: [camada/backend, tipo/modulo]
camala: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: users

Gerenciar perfil de usuário, dados pessoais, preferences.

## Propósito

CRUD básico de User (perfil, atualizar dados, deletar conta).

## Controller

`users.controller.ts`

Endpoints:
- GET `/users/me` — retorna User autenticado (JwtAuthGuard)
- PUT `/users/profile` — atualiza name, weight, height, dateOfBirth

## Services

- **UsersService**: CRUD User, validações

## DTOs

- **UpdateProfileInput**: name, weight, height, dateOfBirth
- **UserResponse**: id, email, name, role, weight, height, dateOfBirth, createdAt

## Modelos envolvidos

- [[User]] — tabela principal

## Fluxos

**GET /me:**
1. Cliente envia JWT
2. JwtAuthGuard extrai userId
3. UsersService.getMe(userId)
4. Retorna User completo

**PUT /profile:**
1. Cliente envia JWT + UpdateProfileInput
2. UsersService.updateProfile(userId, input)
3. Valida campos (weight > 0, etc.)
4. Persiste em User
5. Retorna User atualizado

## Dependências

- Prisma — User model
- @nestjs/common — decoradores

---

Ver: [[GET users-me]], [[PUT users-profile]]
