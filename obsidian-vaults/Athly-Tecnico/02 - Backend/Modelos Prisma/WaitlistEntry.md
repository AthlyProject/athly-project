---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: WaitlistEntry

Entrada na fila beta. Rastreia interesse pre-launch.

## Propósito

Gerenciar lista de espera com referrals.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| email | String | false | unique |
| name | String | false | nome da pessoa |
| referralCode | String | false | unique code para compartilhar |
| referrals | Int | false | default: 0 |
| position | Int | true | rank na fila |
| notified | Boolean | false | default: false |
| createdAt | DateTime | false | default: now() |

## Relações

- N:1 User (opcional, se pessoa se registrar depois)

## Usado em

- [[POST waitlist]]
- Rankings em marketing

## Notas

- referrals: count de pessoas que entrou via ref code
- position: calculado por createdAt order
- notified: enviado convite "sua vez"?

---

Ver: [[waitlist]], [[_MOC Modelos]]
