---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 8 - Frontend Integration"
prioridade: media
---

# TASK-021 — OAuthCallbackPage Frontend

## Descrição

Frontend: página que trata callback OAuth (code=...) após autorização Strava.

## Critérios de Aceite

- [ ] Componente OAuthCallbackPage criado (`/oauth/strava/callback`)
- [ ] Parse URL params: `code`, `scope`, `state`
- [ ] Valida code (não vazio, valid format)
- [ ] Envia code ao backend (POST `/integrations/strava/callback?code=...`)
- [ ] Loading spinner enquanto processa
- [ ] Success: "Conectado!" + redirect dashboard
- [ ] Error: mensagem + "Tentar novamente" link
- [ ] Timeout: "Conexão expirou, volte ao settings"

## Fluxo

```
Strava redireciona → /oauth/strava/callback?code=ABC&scope=activity:read_all
  ↓
Parse URL
  ↓
POST /integrations/strava/callback?code=ABC
  ↓
Sucesso → Toast "Conectado!" + goto /dashboard
Erro → Mensagem + retry link
```

## Referências

- TASK-003, TASK-004
- [[Strava - Fluxo OAuth]]
