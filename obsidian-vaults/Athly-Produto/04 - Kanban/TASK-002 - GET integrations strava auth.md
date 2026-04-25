---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 1 - Strava OAuth"
prioridade: alta
---

# TASK-002 — GET /integrations/strava/auth

## Descrição

Criar endpoint que gera URL de autorização Strava (OAuth).

## Critérios de Aceite

- [ ] GET `/integrations/strava/auth` implementado
- [ ] Retorna JSON: `{ authUrl: "https://www.strava.com/oauth/authorize?..." }`
- [ ] Inclui `client_id`, `redirect_uri`, `scope=activity:read_all`, `approval_prompt=force`
- [ ] Testa com client real (Strava OAuth)
- [ ] Documentado em Swagger/OpenAPI

## Resposta Esperada

```json
{
  "authUrl": "https://www.strava.com/oauth/authorize?client_id=...&redirect_uri=...&scope=activity:read_all&approval_prompt=force"
}
```

## Referências

- [[Strava - Fluxo OAuth]]
- TASK-001
