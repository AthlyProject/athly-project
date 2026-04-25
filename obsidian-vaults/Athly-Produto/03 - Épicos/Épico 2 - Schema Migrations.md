---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 2 — Schema Migrations

## Descrição

Criar tabelas e campos necessários para armazenar tokens Strava e vincular atividades.

## Tasks Relacionadas

- [[TASK-005 - Campos OAuth em Integration]]
- [[TASK-006 - stravaActivityId em Workout]]

## Critérios de Aceite

✅ `Integration` table com stravaAccessToken, stravaRefreshToken, expiresAt  
✅ `Workout.stravaActivityId` (UNIQUE, nullable)  
✅ `Workout.source` campo (strava | ai | manual)  
✅ Migrations executadas sem erro  
✅ Testes de constraint (UNIQUE stravaActivityId)  

## Dependências

**Bloqueado por:** [[Épico 1 - Strava OAuth]] (sequencial)

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
