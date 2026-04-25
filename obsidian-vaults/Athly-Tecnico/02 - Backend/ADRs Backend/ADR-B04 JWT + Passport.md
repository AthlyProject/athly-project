---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B04: JWT + Passport para auth

Estateless authentication com JWT. Access token 1h, refresh em Session table.

## Status

**Implementado** — em produção.

## Decisão

JWT (access) + Refresh token (Session):
- Access: 1h, Bearer token
- Refresh: armazenado em DB, validado no token refresh
- Mobile + Web: localStorage (web), Keychain (iOS)

## Fluxo

```
POST /auth/login → JWT access + refresh token
Request header: Authorization: Bearer {access_token}
Expired? POST /auth/refresh com refresh_token
401 → client refresh automático
```

## Justificativa

1. **Stateless**: access token não precisa validação em DB
2. **Segurança**: refresh token em DB (pode ser revogado)
3. **Mobile-friendly**: suporta offline scenarios
4. **Standard**: OAuth 2.0 compatible

## Alternativas rejeitadas

- Session table única (statefull, não escalável)
- Opaque tokens (mais overhead)
- mTLS (overkill para MVP)

---

Ver: [[auth]], [[POST auth-login]], [[Auth Flow (backend + frontend + iOS)]]
