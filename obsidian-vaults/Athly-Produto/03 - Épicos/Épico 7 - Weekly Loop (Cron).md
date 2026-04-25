---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 7 — Weekly Loop (Cron)

## Descrição

Implementar cron automático que regenera planos toda segunda-feira 6h.

## Tasks Relacionadas

- [[TASK-017 - Instalar nestjs-schedule]]
- [[TASK-018 - Cron job semanal]]

## Critérios de Aceite

✅ Pacote @nestjs/schedule instalado  
✅ Cron job: `0 6 * * 1` (seg 6h, em local timezone)  
✅ Para cada usuário com Strava:
  - Refresh token
  - Sync últimos 30 dias
  - Gera novo plano IA
  - Substitui plano anterior
  - Envia notificação
✅ Error handling: retry 3x, log failures  
✅ Jitter na execução (distribuir carga)  
✅ Fallback para botão manual se cron falhar  

## ADRs Relacionadas

- [[ADR-004 - Regeneração automática semanal via Cron]]

## Dependências

**Bloqueado por:** [[Épico 6 - Training Plan Generation]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
