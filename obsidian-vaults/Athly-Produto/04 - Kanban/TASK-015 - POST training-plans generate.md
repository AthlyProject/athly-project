---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 6 - Training Plan Generation"
prioridade: media
---

# TASK-015 — POST /training-plans/generate

## Descrição

Endpoint que gera novo training plan sob demanda (usuário ou cron).

## Critérios de Aceite

- [ ] POST `/training-plans/generate` (autenticado)
- [ ] Valida Integration.stravaAccessToken existe
- [ ] Se não, retorna 400 (modal obrigatória no frontend)
- [ ] Opcionalmente resync Strava (`?resync=true`)
- [ ] Chama AiService.generateWeeklyPlan
- [ ] Salva TrainingPlan + Workouts (source = "ai")
- [ ] Retorna 200 com plano ou 400 se erro
- [ ] Rate limiting (max 1 req per 10s)

## Request/Response

```
POST /training-plans/generate?resync=true
Authorization: Bearer token

200 OK:
{
  "id": "...",
  "weekStarting": "2026-04-28",
  "workouts": [...]
}

400:
{
  "error": "Strava não conectado"
}
```

## Referências

- TASK-014
- [[Loop do MVP]]
