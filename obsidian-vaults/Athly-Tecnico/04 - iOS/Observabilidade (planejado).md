---
tags: [camada/ios, tipo/documento]
camada: ios
tipo: documento
status: planejado
created: 2026-04-24
---

# Observabilidade: Sentry (Planejado)

5 fases de implementação.

## Fases

### Fase 0: POC Sentry
- SDK integration
- Basic error capture

### Fase 1: Contexto global
- session_id, user_id
- release, build, env vars
- Wrapper próprio

### Fase 2: Instrumentação rede
- APIClient request/response
- Latência, erros HTTP

### Fase 3: Fluxo de corrida
- Breadcrumbs (GPS, pace, splits)
- Eventos de status

### Fase 4: UI diagnóstico
- Debug screen (in-app)
- Session replay (future)

### Fase 5: Hardening
- Amostragem (sampling rate)
- Filtros (regex exclusions)
- Retenção (data policy)

## Correlação com Backend

Headers:
- `X-Athly-Request-Id` — per-request
- `X-Athly-Session-Id` — cross-platform
- `X-Athly-Run-Id` — durante corrida

---

Ver: [[Correlação de observabilidade]], [[ADR-I04 Observabilidade Sentry planejado]]
