---
tags: [tipo/epico, contexto/produto, integracao/strava]
status: todo
created: 2026-04-24
---

# Épico 3 — Strava Sync Service

## Descrição

Implementar serviço que sincroniza atividades do Strava para BD, com refresh automático de token.

## Tasks Relacionadas

- [[TASK-007 - Criar StravaModule]]
- [[TASK-008 - syncActivities 30 dias]]
- [[TASK-009 - Refresh de token Strava]]

## Critérios de Aceite

✅ StravaModule criado com StravaService  
✅ Método `syncActivities(userId)` → fetch 30d da API Strava  
✅ Upsert Workouts com stravaActivityId UNIQUE  
✅ Refresh token automático 5 min antes de expirar  
✅ Tratamento de erros (token expirado, rate limit, connection)  
✅ Testes unitários com mocks de Strava API  

## Dependências

**Bloqueado por:** [[Épico 2 - Schema Migrations]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
