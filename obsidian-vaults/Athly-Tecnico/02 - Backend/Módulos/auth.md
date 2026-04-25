---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: auth

Autenticação JWT + Passport. Login, register, token refresh.

## Propósito

Gerenciar ciclo de vida de tokens JWT (access + refresh) e estratégias de autenticação.

## Controller

`auth.controller.ts`

Endpoints:
- POST `/auth/login` — LoginInput → JWT + refresh token
- POST `/auth/register` — RegisterInput → User + JWT + refresh token

## Services

- **AuthService**: orquestração (valida credenciais, gera tokens)
- **JwtStrategy**: Passport strategy (extrai user do JWT)
- **LocalStrategy**: Passport local (email + password)

## DTOs

- **LoginInput**: email, password
- **RegisterInput**: email, password, name, date_of_birth
- **AuthResponse**: user (User), access_token, refresh_token, expires_in

## Guards

- **JwtAuthGuard**: @UseGuards(JwtAuthGuard) em rotas protegidas
- **Decorador @CurrentUser()**: extrai User do JWT payload

## Modelos envolvidos

- [[User]] — perfil, role, senhas
- [[Session]] — armazena refresh tokens

## Fluxos

**Login:**
1. Frontend POST `/auth/login` (email + pwd)
2. AuthService valida bcrypt
3. Gera JWT access (payload: userId, role)
4. Gera refresh token + salva em Session
5. Retorna access_token + refresh_token

**Register:**
1. Frontend POST `/auth/register` (email, pwd, name)
2. AuthService cria User (hash password)
3. Mesmo que login, emite tokens

**Refresh:**
1. Frontend sends refresh_token
2. Backend: fetch Session, valida
3. Emite novo access_token

## Dependências

- bcrypt — password hashing
- @nestjs/passport — estratégias
- @nestjs/jwt — criação de tokens
- Prisma — persistência (User, Session)

---

Ver: [[POST auth-login]], [[POST auth-register]]
