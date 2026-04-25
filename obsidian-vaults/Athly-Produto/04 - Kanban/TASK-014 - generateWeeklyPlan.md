---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 5 - AI Service"
prioridade: alta
---

# TASK-014 — generateWeeklyPlan

## Descrição

Implementar lógica de geração de plano semanal na AiService.

## Critérios de Aceite

- [ ] Cria prompt com contexto: histórico 30d + preferências
- [ ] Envia prompt à IA (Claude/Gemini)
- [ ] Parsa JSON response: `{ week_starting, workouts: [...] }`
- [ ] Valida structure de cada workout
- [ ] Retorna TrainingPlan bem-formado
- [ ] Fallback a Assessment Plan se falhar (3 retries)
- [ ] Logging de prompt/response (debug mode)

## Estrutura de Resposta Esperada

```json
{
  "week_starting": "2026-04-28",
  "workouts": [
    {
      "day": "monday",
      "type": "easy_run",
      "distance_km": 5,
      "duration_minutes": 35,
      "notes": "..."
    }
  ]
}
```

## Referências

- TASK-013
- [[Loop do MVP]]
