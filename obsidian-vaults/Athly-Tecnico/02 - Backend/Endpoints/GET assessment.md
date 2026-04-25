---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: GET
path: /assessment
modulo: assessment
auth_required: true
status: implementado
created: 2026-04-24
---

# GET /assessment

Retorna status de assessment do usuário.

## Response 200

```json
{
  "status": "incomplete|complete",
  "completedAt": "2026-04-24T10:00:00Z",
  "data": {...}
}
```

---

Ver: [[assessment]]
