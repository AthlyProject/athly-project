---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: equipments

Gerenciar equipamentos (sapatos, relógios, etc.).

## Propósito

CRUD de Equipment (catálogo) + UserEquipment (associação do usuário).

## Controller

`equipments.controller.ts`

Endpoints:
- GET `/equipments` — listar todos equipamentos (catálogo)
- GET `/equipments/my-equipments` — equipamentos do usuário
- GET `/equipments/:uuid` — detalhe equipamento
- POST `/equipments` — criar equipamento (admin)
- PUT `/equipments/:uuid` — atualizar (admin)
- DELETE `/equipments/:uuid` — deletar (admin)
- POST `/equipments/:equipmentId/add` — usuário adiciona à sua lista
- DELETE `/equipments/:equipmentId/remove` — usuário remove

## Services

- **EquipmentsService**: CRUD Equipment
- **UserEquipmentsService**: gerenciar UserEquipment (relação)

## DTOs

- **CreateEquipmentInput**: name, brand, type, weight (kg), notes
- **EquipmentResponse**: id, name, brand, type, weight, notes

## Modelos envolvidos

- [[Equipment]] — catálogo
- [[UserEquipment]] — associação usuário-equipamento

## Fluxos

**GET /equipments/my-equipments:**
1. JwtAuthGuard extrai userId
2. Fetch UserEquipment onde userId = user
3. JOIN Equipment para retornar full data

**POST /equipments/:equipmentId/add:**
1. Cria UserEquipment (userId, equipmentId)
2. Retorna equipamento adicionado

## Dependências

- Prisma — Equipment, UserEquipment

---

Ver: [[Equipment]], [[UserEquipment]]
