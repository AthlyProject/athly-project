---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /integrations/:id/connect
modulo: integrations
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /integrations/:id/connect

Conecta integração via OAuth callback.

## Request

```json
{
  "code": "strava_oauth_code"
}
```

## Response 201

[[Integration]] conectada.

## Fluxo

1. Troca code por access_token (Strava API)
2. Salva em Integration table
3. Opcionalmente synca atividades

---

Ver: [[integrations]], [[strava]], [[Strava Flow (backend + frontend)]]
