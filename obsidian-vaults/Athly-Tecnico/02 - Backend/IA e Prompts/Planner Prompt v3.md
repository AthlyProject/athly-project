---
tags: [camada/backend, tipo/prompt]
camada: backend
tipo: prompt
status: implementado
created: 2026-04-24
---

# Prompt: Planner v3.0

Prompt principal para geração de 7 workouts semanais. Versão 3.0 (atual).

## Entrada (inputs montados by AiPlannerService)

```json
{
  "user": {
    "name": "João Silva",
    "age": 30,
    "fitnessLevel": "intermediate"
  },
  "goal": {
    "target": "Complete 10k in 45 minutes",
    "deadline": "2026-07-15",
    "currentPB": "10k: 48:30"
  },
  "assessment": {
    "experienceLevel": "3 years running",
    "zones": { "z1": "easy", "z2": "aerobic", "z3": "tempo", "z4": "threshold", "z5": "vo2max" },
    "preferredSports": ["running"]
  },
  "recentRuns": [
    { "date": "2026-04-23", "distance": 8, "pace": "5:50", "perceived_effort": 6 },
    { "date": "2026-04-20", "distance": 10, "pace": "5:45", "perceived_effort": 7 }
  ],
  "previousWeekAnalysis": {
    "totalKm": 35,
    "avgPace": "5:48",
    "adherence": "5/7 workouts completed"
  }
}
```

## Saída esperada (JSON)

```json
{
  "workouts": [
    {
      "day": 1,
      "sportType": "running",
      "estimatedDurationMinutes": 40,
      "estimatedDistanceKm": 6,
      "description": "Easy recovery run",
      "blocks": {
        "warmUp": { "duration_min": 5, "type": "easy" },
        "main": { "duration_min": 30, "distance_km": 5.5, "type": "easy", "zone": "z1" },
        "coolDown": { "duration_min": 5, "type": "easy" }
      }
    },
    { "day": 2, ... },
    { "day": 3, ... }
  ],
  "reasoning": "Progressão: seg(easy)→ter(tempo)→qua(easy)→qui(VO2)→sex(easy)→sab(long)→dom(rest). Baseado em performance recente."
}
```

## Características v3.0

- 7 workouts (mon-sun, rest day optional)
- Progresso semanal: easy → hard → easy
- Resposta JSON estruturada
- Reasoning incluído
- Considere zonas customizadas
- Adapte para goal + histórico

## Linguagem

Português (BR), instruções em PT, response JSON em inglês.

---

Ver: [[AiPlannerService]], [[_MOC IA e Prompts]]
