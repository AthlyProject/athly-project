---
tags: [tipo/ambiguidade, contexto/produto, status/aberto]
status: done
created: 2026-04-24
---

# Ambiguidade — Redirect URI Discrepância

## Pergunta

**STRAVA_REDIRECT_URI: `/integrations/strava/callback` ou `/oauth/strava/callback`?**

---

## Contexto

Documentações diferem:
- MVP_KANBAN.md: POST `/integrations/strava/callback`
- STRAVA_INTEGRATION_PLAN.md: `/oauth/strava/callback` (implícito)
- TASK-003: POST `/integrations/strava/callback`

Qual é correto?

---

## Opções

### 1. `/integrations/strava/callback` (Implementação Atual)
**Prós:**
- Consistente com `/integrations/strava/auth`
- Mais RESTful (resource = integration)
- Já implementado em TASK-003

**Contras:**
- Nenhum problema técnico

---

### 2. `/oauth/strava/callback`
**Prós:**
- Indica propósito (OAuth callback)
- Semântica clara

**Contras:**
- Inconsistente com `/integrations/strava/auth`
- Requer mudança em TASK-003, TASK-021

---

## Recomendação

**Use `/integrations/strava/callback`** — mais consistente e já implementado.

Se Strava tem restricão, pode redirecionar em proxy (Nginx/Caddy):
```nginx
location /oauth/strava/callback {
  return 301 /integrations/strava/callback$args;
}
```

---

## Ação

1. Confirmar com time backend
2. Documentar em ambos PRD e código
3. Adicionar comentário em TASK-003

---

## Referências

- TASK-002, TASK-003, TASK-021
- [[Strava - Fluxo OAuth]]
