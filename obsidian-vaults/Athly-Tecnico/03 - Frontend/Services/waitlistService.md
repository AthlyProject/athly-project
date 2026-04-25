---
tags: [tipo/servico, camada/frontend, dominio/pre-lancamento]
tipo: servico
camada: frontend
arquivo: src/services/waitlistService.ts
status: implementado
created: 2026-04-24
---

# waitlistService

## Propósito
Inscrever visitantes da [[LandingPage]] em uma lista de espera pré-lançamento.

## API pública

| Método | Endpoint |
|--------|----------|
| `joinWaitlist(name, email)` | [[POST waitlist]] |

## Consumido por
- [[LandingPage]] (seção "Waitlist")

## Shape
- `name: string`
- `email: string` (UNIQUE no backend)

## Tratamento de erros
- 409: email já inscrito → toast informativo
- Outros: toast de erro genérico

## Notas
- Modelo correspondente: [[WaitlistEntry]]
- Não requer auth
