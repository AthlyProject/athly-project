---
tags: [camada/cross, tipo/fluxo]
camada: cross
tipo: documento
status: implementado
created: 2026-04-24
---

# Auth Flow: Backend + Frontend + iOS

End-to-end authentication.

## 1. Register (Frontend/iOS)

```
User inputs email, password, name
POST /auth/register → Backend
Backend: validates, hash, create User, emit JWT + refresh
Response: { user, access_token, refresh_token }
```

## 2. Store tokens

**Frontend**: localStorage ('iafit-auth')
**iOS**: Keychain (secure storage)

## 3. Authenticated requests

Append header:
```
Authorization: Bearer {access_token}
```

## 4. Refresh on 401

```
Token expired?
POST /auth/refresh { refresh_token }
Backend: validates, emits new access_token
Response: new JWT
Client: retry original request
```

## 5. Logout

Delete localStorage (web), clear Keychain (iOS).

---

Ver: [[Fluxos cross-cutting]], [[auth]], [[Auth Flow (backend + frontend + iOS)]]
