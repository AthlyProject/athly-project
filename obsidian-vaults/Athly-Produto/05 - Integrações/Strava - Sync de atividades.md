---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Sync de Atividades

## Visão Geral

Sincronização automática puxa últimos 30 dias de atividades de Strava para a BD Athly.

---

## Timing

| Trigger | Frequência | Quem |
| --- | --- | --- |
| **Automático** | Toda seg 6h | Cron (@nestjs/schedule) |
| **Manual** | On-demand | Usuário (Settings button) |
| **Callback OAuth** | Imediatamente após conectar | Backend (fire-and-forget) |

---

## Fluxo de Sync

```
Trigger (cron/manual/OAuth)
  ↓
Para cada usuário com Integration.stravaAccessToken:
  ├─ Refresh token se expirado (5 min antes)
  ├─ GET https://www.strava.com/api/v3/athlete/activities
  │   params: after=<30_days_ago>, per_page=200
  ├─ Parse resposta:
  │   [
  │     {
  │       "id": 6992727,
  │       "name": "Morning Run",
  │       "type": "Run",
  │       "distance": 5000,
  │       "moving_time": 1800,
  │       "start_date": "2026-04-24T06:00:00Z"
  │     },
  │     ...
  │   ]
  ├─ Para cada atividade:
  │   └─ Upsert Workout:
  │       stravaActivityId = "6992727"
  │       modalidade = mapear(type)
  │       distance = 5km
  │       duration = 30 min
  │       source = "strava"
  │       createdAt = start_date
  └─ Log: "Sincronizadas 12 atividades para user X"
```

---

## Mapeamento Modalidades

| Strava Type | Athly Modalidade |
| --- | --- |
| Run, TrailRun | **running** |
| Ride, VirtualRide | **cycling** |
| Swim | **swimming** |
| WeightTraining | **strength** |
| CrossFit | **crossfit** |
| Walk, Hike | **walking** |
| Yoga | **yoga** |
| Outros | **other** |

---

## Deduplicação

**Campo:** `Workout.stravaActivityId` (UNIQUE)

```
Se atividade existe (stravaActivityId já na BD):
  → Update (atualiza distance, duration se mudou)
Se nova:
  → Insert
```

---

## Erros & Retry

```
Erro na sync?
  ├─ Token expirado → refresh + retry
  ├─ Rate limit (429) → backoff exponencial + retry
  ├─ Network error → retry 3x
  ├─ Invalid response → log + skip
  └─ Strava API down (5xx) → schedule retry em 1h
```

---

## Exemplo Request

```
GET https://www.strava.com/api/v3/athlete/activities
Authorization: Bearer {accessToken}
Content-Type: application/json

?after=1713868800  (30 days ago)
&per_page=200
```

---

## Referências

- [[ADR-007 - Janela de 30 dias para histórico Strava]]
- TASK-007, TASK-008, TASK-009
- [[Strava - Mapeamento de esportes]]
