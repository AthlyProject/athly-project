---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 3 - Strava Sync Service"
prioridade: alta
---

# TASK-009 — Refresh de Token Strava

## Descrição

Implementar refresh automático de token Strava 5 minutos antes de expirar.

## Critérios de Aceite

- [ ] Método `refreshTokenIfExpired(userId)` no StravaService
- [ ] Check: `expiresAt - 5min < now()` → refresh
- [ ] Chama Strava API: `POST /oauth/token` com refreshToken
- [ ] Atualiza Integration.stravaAccessToken, expiresAt
- [ ] Transparente (não quebra sync)
- [ ] Testes com tokens expirados/válidos

## Lógica

```
if (Integration.expiresAt - 5min < now()):
  POST https://www.strava.com/oauth/token
    client_id, client_secret, refresh_token, grant_type=refresh_token
  → get new accessToken, refreshToken, expiresAt
  → update Integration
```

## Referências

- [[Strava - Fluxo OAuth]]
- TASK-007, TASK-008
