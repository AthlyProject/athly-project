---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: Equipment

Catálogo de equipamentos (sapatos, relógios, coletes, etc.).

## Propósito

Armazena equipamentos disponíveis. Usuários associam via UserEquipment.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| name | String | false | "Nike Pegasus 40" |
| brand | String | false | "Nike" |
| type | String | false | "running_shoe", "watch", etc. |
| weight | Float | true | kg |
| notes | String | true | detalhes |
| createdAt | DateTime | false | default: now() |

## Relações

- 1:N UserEquipment

## Usado em

- [[POST equipments]] (admin)
- [[GET equipments/my-equipments]]

## Notas

- Catálogo (admin-populated)
- Usuários não criam novos (ou criar request é moderado)

---

Ver: [[UserEquipment]], [[equipments]], [[_MOC Modelos]]
