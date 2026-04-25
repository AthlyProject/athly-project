---
tags: [tipo/moc, contexto/produto, status/ambiguo]
status: done
created: 2026-04-24
---

# MOC — Ambiguidades e Abertos

Gaps, dúvidas e decisões pendentes no MVP.

---

## Abertos Críticos

⚠️ [[Divergência IA Claude vs Gemini]] — Claude planejado, Gemini implementado  
→ Requer decisão executiva

---

## Abertos Técnicos

- [[Redirect URI discrepância]] — `/integrations/strava/callback` vs `/oauth/strava/callback`
- [[Rate limiting IA]] — Limite de chamadas IA não especificado
- [[Retry em falha de IA]] — Lógica de retry não documentada
- [[Notificações - pendente]] — Frequência e canal de notificações
- [[Strava sem atividades nos 30 dias]] — Fallback se usuário não tem histórico
- [[autoGenerate default]] — TrainingPlan começa com autoGenerate=true?
- [[Delete Workouts ao desconectar Strava]] — Limpar dados ao revogar?

---

## Status Síntese

| Aberto | Prioridade | Status |
| --- | --- | --- |
| IA Claude vs Gemini | **CRÍTICA** | 🟡 Aberto |
| Redirect URI | Alta | 🟡 Aberto |
| Rate limiting | Média | 🟡 Aberto |
| Notificações | Média | 🟡 Aberto |
| Retry IA | Média | 🟡 Aberto |
| Fallback 30d | Média | 🟡 Aberto |
| autoGenerate | Baixa | 🟡 Aberto |
| Delete Workouts | Baixa | 🟡 Aberto |

---

**Próximas:** [[00 - Home]]
