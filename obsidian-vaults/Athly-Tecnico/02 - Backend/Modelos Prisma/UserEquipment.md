---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: UserEquipment

Associação entre usuário e equipamentos que usa.

## Propósito

N:N entre User e Equipment. Rastreia equipamentos ativos do usuário.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| equipmentId | UUID | false | FK Equipment |
| addedAt | DateTime | false | default: now() |

## Relações

- N:1 User
- N:1 Equipment

## Índices

- (userId, equipmentId) → unique

## Usado em

- [[POST equipments/:equipmentId/add]]
- [[DELETE equipments/:equipmentId/remove]]
- [[GET equipments/my-equipments]]

---

Ver: [[Equipment]], [[User]], [[equipments]], [[_MOC Modelos]]
