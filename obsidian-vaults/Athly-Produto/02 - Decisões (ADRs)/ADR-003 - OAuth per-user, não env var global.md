---
tags: [tipo/adr, contexto/produto, status/aceito, integracao/strava]
status: done
created: 2026-04-24
adr_number: 3
---

# ADR-003 — OAuth per-user, Não Env Var Global

## Status
**Aceito** — Implementado em TASK-001 a TASK-003

## Contexto

Ao integrar Strava, havia duas abordagens possíveis:

1. **Global/Aplicativo:** Uma conta Strava por toda a aplicação (env var `STRAVA_API_TOKEN`)
2. **Per-User:** Cada usuário conecta sua própria conta (OAuth 2.0)

A abordagem global seria mais simples técnicamente, mas viola segurança e UX.

## Decisão

**OAuth 2.0 per-user:**
- Cada usuário autentica com própria conta Strava
- Cada usuário recebe `accessToken` + `refreshToken` únicos
- Tokens armazenados na BD por usuário (tabela `Integration`)

```
User 1 → Strava OAuth → accessToken_1, refreshToken_1 (stored in Integration)
User 2 → Strava OAuth → accessToken_2, refreshToken_2 (stored in Integration)
User N → ...
```

## Consequências

### Positivas
✅ Segurança: cada usuário controla próprio token  
✅ Privacidade: dados Strava de um usuário isolados de outro  
✅ Escalabilidade: não há "overhead" de global connection pool  
✅ Compliance: atende GDPR (dados pessoais segregados)  

### Negativas
❌ Complexidade maior: cada request precisa usar token do usuário correto  
❌ Rate limiting Strava é per-user, não agregado  
❌ Refresh logic deve ser robusto (5 min antes de expirar)  

### Trade-offs
- Segurança > simplicity

## Alternativas Consideradas

### Global API Token (env var)
- ❌ Uma conta Strava para todos os usuários (app account)
- ❌ Privacidade violada (um usuário vê dados de outro)
- ❌ Token único é ponto único de falha
- ❌ Não funciona para múltiplos usuários

---

## Implementação

**Tabela `Integration`:**
```sql
CREATE TABLE Integration (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL REFERENCES User(id),
  stravaAccessToken VARCHAR NOT NULL,
  stravaRefreshToken VARCHAR NOT NULL,
  stravaExpiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Endpoints:**
- POST `/integrations/strava/auth` → gera URL OAuth
- GET `/integrations/strava/callback` → valida code, salva tokens
- Refresh automático 5 min antes de expirar

---

## Referências

- [[05 - Integrações/Strava - Fluxo OAuth]]
- [[03 - Épicos/Épico 1 - Strava OAuth]]
- TASK-001, TASK-002, TASK-003
