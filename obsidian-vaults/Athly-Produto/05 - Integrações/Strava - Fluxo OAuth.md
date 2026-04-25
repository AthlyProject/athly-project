---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Fluxo OAuth

## Sequência Detalhada

### 1. Frontend: Usuário clica "Conectar Strava"

```
GET /integrations/strava/auth
  ↓
Backend: gera URL OAuth com state
  ↓
200: { authUrl: "https://www.strava.com/oauth/authorize?client_id=...&state=xyz..." }
  ↓
Frontend: window.open(authUrl)
```

---

### 2. Strava: Autorização

```
Usuário no Strava (se não logado, loga antes)
  ↓
"Athly quer access a atividades"
  ↓
[Botão: Autorizar]
  ↓
Strava valida scopes + redireciona:
  → http://localhost:3000/integrations/strava/callback?code=ABC123&state=xyz
```

---

### 3. Frontend OAuthCallbackPage: Recebe code

```
GET /integrations/strava/callback?code=ABC123&state=xyz
  ↓
OAuthCallbackPage:
  - Parse URL
  - Validate code (not null, length ok)
  - POST /integrations/strava/callback?code=ABC123
  ↓
Loading spinner...
```

---

### 4. Backend: Troca code por tokens

```
POST /integrations/strava/callback?code=ABC123
  (autenticado, tem userId)
  ↓
Backend StravaService:
  POST https://www.strava.com/oauth/token
    {
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code: ABC123,
      grant_type: authorization_code
    }
  ↓
200 OK:
  {
    "token_type": "Bearer",
    "expires_at": 1234567890,
    "expires_in": 21600,
    "refresh_token": "XYZ...",
    "access_token": "ABC..."
  }
  ↓
Save em DB:
  Integration {
    userId: current_user,
    stravaAccessToken: ABC...,
    stravaRefreshToken: XYZ...,
    stravaExpiresAt: 1234567890
  }
  ↓
200 OK: { status: "connected" }
```

---

### 5. Frontend: Sucesso

```
Toast: "Strava conectado!"
  ↓
Redirect: /dashboard
```

---

## Diagrama Swimlanes

```
Frontend          |  Backend           |  Strava
                  |                    |
Click "Conectar"  |                    |
  ┌──────────────→ GET /strava/auth   |
  │               ├─────────────────→  Generate URL
  │               ←─────────────────┤  auth URL
  │ ←──────────────────────────────┤
  │               
Open window       |                    |
  └──────────────────────────────────→ https://strava.com/oauth/authorize
                  |                    ├─ Login check
                  |                    ├─ Scope confirmation
                  |     redirect code ←┤
                  |
Parse callback    |                    |
  ┌──────────────→ POST /strava/callback
  │               ├─────────────────→  POST /oauth/token
  │               ←────────────────┤  access_token
  │               Save Integration |
  │ ←──────────────────────────────┤
  │
Redirect dashboard
```

---

## Segurança

- **State parameter:** Previne CSRF attacks
- **Per-user tokens:** Cada usuário tem próprio access/refresh token
- **Refresh logic:** Token renovado 5 min antes de expirar (transparente)
- **Scope**: `activity:read_all` (read-only, não permite write/delete)

---

## Referências

- [[ADR-003 - OAuth per-user, não env var global]]
- TASK-002, TASK-003, TASK-004, TASK-021
- [[Strava - Variáveis de ambiente]]
