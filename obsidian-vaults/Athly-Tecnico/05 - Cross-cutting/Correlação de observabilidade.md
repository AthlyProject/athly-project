---
tags: [camada/cross, tipo/documento]
camada: cross
tipo: documento
status: planejado
created: 2026-04-24
---

# Correlação de Observabilidade

Headers para rastrear requests across layers.

## Headers

| Header | Gerado | Uso |
|--------|--------|-----|
| X-Athly-Request-Id | UUID (per-request) | Cada chamada HTTP |
| X-Athly-Session-Id | UUID (per-login) | Cross-platform session |
| X-Athly-Run-Id | UUID (start run) | Durante corrida |

## Flow

**Frontend login**:
```
1. User logs in → POST /auth/login
2. Backend gera Session
3. Frontend stores session_id (localStorage)
4. Adiciona X-Athly-Session-Id em todas requests
```

**iOS run start**:
```
1. User inicia corrida
2. iOS gera run_id (UUID)
3. Passa em X-Athly-Run-Id
4. Backend correlaciona com Sentry
5. Sentry agrupa events por run
```

## Observabilidade

Sentry integração:
- session_id = tags.session
- run_id = tags.run
- request_id = breadcrumb

---

Ver: [[Observabilidade (planejado)]], [[_MOC Cross-cutting]]
