---
tags: [camada/cross, tipo/fluxo]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# Strava Flow: Backend + Frontend

OAuth integration com Strava.

## 1. User clica "Connect Strava"

Frontend: redirect to Strava OAuth
```
https://www.strava.com/oauth/authorize?
  client_id=XXX&
  redirect_uri=https://app.athly.com/oauth/strava/callback&
  scopes=activities:read,profile:read
```

## 2. User autoriza em Strava

Strava: redirect com code
```
https://app.athly.com/oauth/strava/callback?code=abc123&scope=...
```

## 3. Frontend troca code

```
POST /integrations/strava/connect { code }
Backend: 
  - troca code por access_token + refresh (via Strava API)
  - armazena em Integration table
  - opcionalmente synca últimas atividades
```

## 4. Resposta

```json
{
  "type": "strava",
  "isConnected": true,
  "lastSync": "2026-04-24T10:00:00Z"
}
```

## 5. AI planner usa Strava

AiPlannerService.planNextWeek():
- Fetch Strava runs (últimas 4 semanas)
- Analisa volume, pace, trends
- Monta prompt com histórico
- Gemini gera plano considerando performance

---

Ver: [[Fluxos cross-cutting]], [[strava]], [[integrations]]
