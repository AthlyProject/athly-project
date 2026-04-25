---
tags: [camada/backend, tipo/prompt]
camada: backend
tipo: prompt
status: implementado
created: 2026-04-24
---

# Prompt: Goal Parser

Extrai target metrics de um objetivo em linguagem natural.

## Entrada

```
"Quero correr uma maratona em menos de 3h45min na Maratona de São Paulo em julho de 2026"
```

## Saída esperada (JSON)

```json
{
  "isRunningRelated": true,
  "title": "Maratona SP 2026 sub-3:45",
  "targetDistance": 42.195,
  "targetTime": "03:45:00",
  "eventName": "Maratona de São Paulo",
  "eventDate": "2026-07-15T08:00:00",
  "experienceLevel": "intermediate"
}
```

## Validações

- `isRunningRelated`: descarta goals não-corrida
- `targetDistance` > 0
- `eventDate` no futuro
- Extract experience level (iniciante, intermediário, avançado)

## Casos especiais

- "Correr 10k em 45 minutos" → sem eventDate
- "Triathlon" → rejeita (não é running puro)
- "Completar ultra" → detecta ultra distance

---

Ver: [[goals]], [[Goal Parser Prompt]], [[_MOC IA e Prompts]]
