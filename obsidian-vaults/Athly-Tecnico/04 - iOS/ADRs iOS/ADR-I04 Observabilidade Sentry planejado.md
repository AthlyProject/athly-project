---
tags: [tipo/adr, camada/ios, tema/observabilidade]
tipo: adr
camada: ios
status: planejado
created: 2026-04-24
---

# ADR-I04 — Observabilidade via Sentry (planejado)

## Status
proposto (não implementado ainda)

## Contexto
O app iOS lida com GPS contínuo, HealthKit, Live Activities, background tasks, integração com backend AWS. Falhas silenciosas em qualquer dessas áreas prejudicam a UX sem feedback claro. Precisamos de telemetria estruturada e crash reporting.

## Decisão (proposta)
Adotar **Sentry iOS** como provider principal, com um **wrapper `Observability` próprio** para desacoplar dependência. Implementar em **5 fases**:

1. **Fase 0 — POC**: validar SDK, integração e build
2. **Fase 1 — Wrapper + contexto global**: `session_id`, `user_id`, `release`, `build`, `env`
3. **Fase 2 — Instrumentação de rede**: spans no [[APIClient]]
4. **Fase 3 — Fluxo de corrida**: breadcrumbs start/pause/resume/complete/discard
5. **Fase 4 — UI diagnóstico**: tela interna para testers verem últimos eventos
6. **Fase 5 — Hardening**: amostragem, filtros de PII, retenção

Correlação com backend via headers `X-Athly-Request-Id`, `X-Athly-Session-Id`, `X-Athly-Run-Id`.

## Consequências

### Positivas (projetadas)
- Crash reporting com symbolication
- Breadcrumbs contextuais em erros
- Performance spans (rede, HealthKit, GPS)
- Correlação end-to-end com backend AWS

### Negativas
- Custo Sentry (avaliar plano)
- Overhead de SDK no bundle
- Compliance/privacidade: jamais logar senhas, tokens, GPS completo, HealthKit raw

### Trade-offs
- Wrapper adiciona camada mas permite trocar provider sem reescrever call sites

## Alternativas consideradas
- **Firebase Crashlytics** — descartado: menos rico em contexto estruturado
- **Datadog RUM** — avaliado: caro para mobile pequeno; melhor depois
- **Sem observabilidade** — descartado: risco operacional

## Referências
- [[Observabilidade (planejado)]]
- [[APIClient]]
- `athly-ios/OBSERVABILITY_PLAN.md`
