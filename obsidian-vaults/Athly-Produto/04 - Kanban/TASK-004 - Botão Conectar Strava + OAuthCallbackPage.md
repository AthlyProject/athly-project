---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 1 - Strava OAuth"
prioridade: alta
---

# TASK-004 — Botão Conectar Strava + OAuthCallbackPage

## Descrição

Frontend: botão em Settings e página de callback que completa fluxo OAuth.

## Critérios de Aceite

- [ ] Botão "Conectar Strava" em Settings
- [ ] Clique chama GET `/integrations/strava/auth` → abre nova aba Strava
- [ ] Usuário autoriza → Strava redireciona para callback
- [ ] OAuthCallbackPage trata URL (code=...), chama backend, mostra status
- [ ] Se sucesso: "Conectado!" + redirect dashboard
- [ ] Se erro: mensagem clara + opção retry

## Componentes

```
SettingsPage:
  ├─ "Conectar Strava" button
  └─ "Desconectar" button (se já conectado)

OAuthCallbackPage:
  ├─ Parsing URL params (code, scope, state)
  ├─ Loading spinner
  └─ Success/Error states
```

## Referências

- TASK-002, TASK-003
- [[Strava - Fluxo OAuth]]
