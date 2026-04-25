---
tags: [tipo/servico, camada/frontend, dominio/auth]
tipo: servico
camada: frontend
arquivo: src/services/authService.ts
status: implementado
created: 2026-04-24
---

# authService

## Propósito
Encapsula login, registro e logout. Orquestra a atualização de [[useAuthStore]] e do [[ApiManager]] após autenticação.

## API pública

| Método | Endpoint |
|--------|----------|
| `login(email, password)` | [[POST auth-login]] |
| `register(data)` | [[POST auth-register]] |
| `logout()` | Apenas local: limpa store + token |

## Fluxo de login
1. Chama [[POST auth-login]]
2. Recebe `{ user, accessToken, refreshToken }`
3. Chama `api.setToken(accessToken)` ([[ApiManager]])
4. Chama `useAuthStore.setSession(...)` com persistência em localStorage (key `iafit-auth`)
5. Retorna user para o componente

## Consumido por
- [[LoginPage]]
- [[RegisterPage]]

## Tratamento de erros
- Propaga exceções para o componente tratar (toast, destaque de campo)
- 401: senha inválida
- 409: email/username já usado (no register)

## Notas
- MVP aceita qualquer email/senha (mocked) conforme README — integração real ativa progressivamente
