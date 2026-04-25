---
tags: [tipo/servico, camada/frontend, tema/api]
tipo: servico
camada: frontend
arquivo: src/services/api.ts
status: implementado
created: 2026-04-24
---

# ApiManager

## Propósito
Singleton que centraliza a `Configuration` do cliente OpenAPI gerado, gerencia o `accessToken` e expõe instâncias prontas de todas as APIs consumidas pelo app.

## API pública

| Método | Descrição |
|--------|-----------|
| `setToken(token: string)` | Seta bearer token em todas as APIs |
| `clearToken()` | Remove token (logout) |
| `auth`, `users`, `workouts`, `trainingPlans`, `weeklyGoals`, `integrations`, `aiPlanner`, `equipments`, `assessment` | Instâncias do [[Cliente OpenAPI gerado]] |

## Dependências
- [[Cliente OpenAPI gerado]] (src/client/)

## Integração com [[useAuthStore]]
- Ao fazer login → `api.setToken(accessToken)`
- No boot (hydrate do persist) → `api.setToken(stored.accessToken)`
- No logout → `api.clearToken()`

## Tratamento de erros
- Não intercepta diretamente; cada service individual faz try/catch e retorna fallback

## Notas
- É o único ponto que conhece o `baseURL` do backend
- Facilita troca de ambiente (dev/staging/prod)
