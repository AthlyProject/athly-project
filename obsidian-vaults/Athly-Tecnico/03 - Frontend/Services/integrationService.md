---
tags: [tipo/servico, camada/frontend, integracao/strava]
tipo: servico
camada: frontend
arquivo: src/services/integrationService.ts
status: implementado
created: 2026-04-24
---

# integrationService

## Propósito
Facilita o uso de integrações externas (hoje só Strava). Expõe helpers semânticos como `isStravaConnected` que encapsulam a verificação na lista de [[Integration]].

## API pública

| Método | Descrição |
|--------|-----------|
| `getIntegrations()` | Lista integrações do usuário |
| `isStravaConnected(integrations)` | Retorna `boolean` |
| `getStravaAuthUrl()` | URL de autorização OAuth |
| `handleStravaCallback(code)` | Envia `code` ao backend |
| `syncWithStrava()` | Dispara sync manual |

## Fluxo OAuth Strava
1. Usuário clica "Conectar Strava" em [[SettingsPage]] ou [[StravaAuthModal]]
2. Frontend: `window.location.href = getStravaAuthUrl()`
3. Strava redireciona para `/oauth/strava/callback?code=xxx` ([[OAuthCallbackPage]])
4. `handleStravaCallback(code)` → backend troca code por tokens
5. Backend dispara [[Módulo: strava|syncActivities]] (fire-and-forget)

## Consumido por
- [[SettingsPage]]
- [[OAuthCallbackPage]]
- [[DashboardPage]] (modal obrigatória)

## Notas
- Ver [[Strava - Fluxo OAuth]] (no vault de Produto) para decisões de UX
- Ver [[Redirect URI discrepância]] — há divergência entre docs
