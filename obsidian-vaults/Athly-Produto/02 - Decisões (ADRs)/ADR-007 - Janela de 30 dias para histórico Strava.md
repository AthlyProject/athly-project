---
tags: [tipo/adr, contexto/produto, status/aceito, integracao/strava]
status: done
created: 2026-04-24
adr_number: 7
---

# ADR-007 — Janela de 30 Dias para Histórico Strava

## Status
**Aceito** — Implementado em TASK-008

## Decisão

Ao sincronizar/regenerar plano, Athly busca **últimos 30 dias** de atividades Strava.

Cron: `after=<30_days_ago>&per_page=200` (Strava API)

### Por quê 30 dias?

| Janela | Prós | Contras |
| --- | --- | --- |
| **7 dias** | Fresco, determinístico | Pouco contexto (1-2 semanas) |
| **30 dias** ✅ | Contexto bom, relevante | — |
| **90 dias** | Muito contexto | Desatualizado, slow |
| **6 meses+** | Muito histórico | Muito lento, outliers |

**30 dias = Sweet spot:** Contexto suficiente (4-5 semanas) sem overhead

## Implementação

```sql
SELECT * FROM Workout 
WHERE stravaActivityId IS NOT NULL
  AND createdAt >= NOW() - INTERVAL '30 days'
ORDER BY createdAt DESC;
```

---

## Referências

- TASK-008
- [[05 - Integrações/Strava - Sync de atividades]]
