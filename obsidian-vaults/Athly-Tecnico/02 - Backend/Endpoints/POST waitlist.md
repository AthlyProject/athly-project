---
tags: [camada/backend, tipo/endpoint]
camada: backend
tipo: endpoint
metodo: POST
path: /waitlist
modulo: waitlist
auth_required: false
status: implementado
created: 2026-04-24
---

# POST /waitlist

Adiciona email à fila beta.

## Request

```json
{
  "email": "interested@example.com",
  "name": "João Silva"
}
```

## Response 201

```json
{
  "position": 42,
  "referralCode": "JOAOxxxx"
}
```

---

Ver: [[waitlist]], [[WaitlistEntry]]
