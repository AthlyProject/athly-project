---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 8 — Frontend Integration

## Descrição

Integrar tudo no frontend: botão Conectar, modal OAuth, badges, botão Gerar Plano.

## Tasks Relacionadas

- [[TASK-019 - Badges de origem na PlanPage]]
- [[TASK-020 - Botão Gerar Plano]]
- [[TASK-021 - OAuthCallbackPage frontend]]

## Critérios de Aceite

✅ Botão "Conectar Strava" (Settings) → abre OAuth  
✅ OAuthCallbackPage trata redirect de Strava  
✅ Modal obrigatória StravaAuthModal (bloqueia gerar sem conectar)  
✅ Dashboard mostra plano com badges: 🟦 Strava, 🤖 IA, ✏️ Manual  
✅ Botão "Gerar novo plano" dispara POST `/training-plans/generate`  
✅ Status loading enquanto gera  
✅ Edição manual de workouts (source muda para "manual")  

## Dependências

**Bloqueado por:** [[Épico 7 - Weekly Loop (Cron)]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
