---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: waitlist

Gerenciar fila beta (usuários interessados pre-launch).

## Propósito

Coletar emails de beta testers, notificações, ranking.

## Controller

`waitlist.controller.ts`

Endpoints:
- POST `/waitlist` — adicionar email à fila

## Services

- **WaitlistService**: CRUD, envio de notificações

## DTOs

- **WaitlistInput**: email, name, referralCode (opcional)
- **WaitlistResponse**: id, email, position, referralCount

## Modelos envolvidos

- [[WaitlistEntry]] — entrada na fila

## Fluxos

**POST /waitlist:**
1. Cliente POST email + name
2. WaitlistService.addEntry(email, name)
3. Valida email (formato, único)
4. Gera referralCode (share para amigos)
5. Persiste em WaitlistEntry
6. Opcionalmente: envio de email de confirmação
7. Retorna WaitlistResponse { position: N, referralCode }

## Dependências

- Prisma — WaitlistEntry
- Email service (opcional)

---

Ver: [[WaitlistEntry]], [[POST waitlist]]
