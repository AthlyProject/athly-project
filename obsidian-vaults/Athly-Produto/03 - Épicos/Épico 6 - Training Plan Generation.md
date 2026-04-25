---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 6 — Training Plan Generation

## Descrição

Criar endpoints para gerar plano de treino via IA (manual e admin).

## Tasks Relacionadas

- [[TASK-015 - POST training-plans generate]]
- [[TASK-016 - POST training-plans cron-trigger]]

## Critérios de Aceite

✅ POST `/training-plans/generate` (usuário) → gera novo plano  
✅ POST `/training-plans/cron-trigger` (admin) → trigger manual do cron  
✅ Valida Integration.stravaAccessToken antes de gerar  
✅ Se não houver Strava, resync opcionalmente ou usa prefs  
✅ Salva TrainingPlan + Workouts (source = "ai")  
✅ Retorna 200 com plano ou 400 se validação falhar  
✅ Rate limiting em chamadas IA (não mais que 1 req/10s)  

## Dependências

**Bloqueado por:** [[Épico 5 - AI Service]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
