---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /goals
modulo: goals
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /goals

Cria novo objetivo (com parsing via IA).

## Request

```json
{
  "title": "Completar maratona SP 2026",
  "description": "Correr maratona em menos de 3:45"
}
```

## Response 201

[[UserGoal]] criado (com target extraído).

## Fluxo

1. Chama [[Goal Parser Prompt]] via Gemini
2. Extrai targetDistance, targetTime, eventDate
3. Persiste em UserGoal

---

Ver: [[goals]], [[Goal Parser Prompt]]
