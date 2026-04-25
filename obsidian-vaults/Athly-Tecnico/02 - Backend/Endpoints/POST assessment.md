---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /assessment
modulo: assessment
auth_required: true
status: implementado
created: 2026-04-24
---

# POST /assessment

Submete respostas do assessment (5 sessões).

## Request

```json
{
  "answers": [
    { "sessionId": 1, "responses": {...} },
    { "sessionId": 2, "responses": {...} }
  ]
}
```

## Response 201

[[Assessment]] criado.

## Fluxo

1. Valida respostas
2. Opcionalmente: parse com Gemini (extrair zonas, level)
3. Marca User.assessmentCompleted = true
4. Persiste [[Assessment]]

---

Ver: [[assessment]], [[Assessment Prompt]]
