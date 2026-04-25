---
tags: [camada/backend, tipo/adr]
camada: backend
tipo: adr
status: implementado
created: 2026-04-24
---

# ADR-B01: Migração GraphQL → REST

Fevereiro 2026. Removeu Apollo/resolvers, criou controllers REST.

## Status

**Implementado** — 100% REST em produção.

## Contexto

MVP inicial usava GraphQL (Apollo). Feedback indicava complexidade desnecessária para cliente mobile/web pequeno.

## Decisão

Migração para REST puro:
- Controllers NestJS
- JwtAuthGuard + @CurrentUser
- DTOs validados (class-validator + Zod)
- Endpoints RESTful padrão

## Justificativa

1. **Simplicidade**: REST é mais direto para client mobile
2. **Performance**: menos overhead query parsing
3. **Autenticação**: padrão JWT + Bearer token
4. **Documentação**: Swagger automático
5. **Cache**: REST-native caching strategies

## Consequências

**Positivas:**
- Menor curva de aprendizado (mobile dev)
- Debugging facilitado (curl, Postman)
- Swagger docs gerados automaticamente

**Negativas:**
- Over-fetching possível (resolvido com query params)
- Redesign de endpoints (resolvido)

## Alternativas rejeitadas

- Manter GraphQL (complexidade)
- gRPC (overkill para mobile)
- Custom protocol (não-standard)

---

Ver: [[Stack Backend]], [[_MOC Endpoints]]
