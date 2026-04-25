---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 1 - Strava OAuth"
prioridade: alta
---

# TASK-001 — Variáveis de Ambiente Strava

## Descrição

Configurar variáveis de ambiente necessárias para OAuth com Strava.

## Critérios de Aceite

- [ ] `.env.example` atualizado com `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`
- [ ] `.env` preenchido (dev, staging, prod)
- [ ] Validação no app.module que vars existem (throw erro se não)
- [ ] Documentação em README.md

## Variáveis

```
STRAVA_CLIENT_ID=<client_id>
STRAVA_CLIENT_SECRET=<client_secret>
STRAVA_REDIRECT_URI=http://localhost:3000/integrations/strava/callback
STRAVA_API_BASE_URL=https://www.strava.com/api/v3
```

## Referências

- [[ADR-003 - OAuth per-user, não env var global]]
- [[Strava - Variáveis de ambiente]]
