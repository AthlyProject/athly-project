---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 1 - Strava OAuth"
prioridade: alta
---

# TASK-003 — POST /integrations/strava/callback

## Descrição

Endpoint que recebe authorization code de Strava e troca por tokens.

## Critérios de Aceite

- [ ] GET `/integrations/strava/callback?code=...` tratado
- [ ] Chama Strava API com code → recebe accessToken, refreshToken, expiresAt
- [ ] Salva em `Integration` table (por userId)
- [ ] Retorna 200 com status ou 400 se erro
- [ ] Valida expiresAt e calcula refresh strategy
- [ ] Testes com mock Strava API

## Fluxo

```
Frontend envia GET /integrations/strava/callback?code=ABC123
  ↓
Backend troca code por tokens via Strava API
  ↓
Salva em DB: Integration(userId, stravaAccessToken, stravaRefreshToken, expiresAt)
  ↓
Retorna 200 + redirect para dashboard
```

## Referências

- [[Strava - Fluxo OAuth]]
- TASK-002
