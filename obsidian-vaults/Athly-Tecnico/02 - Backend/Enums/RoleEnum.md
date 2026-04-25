---
tags: [camada/backend, tipo/enum]
camada: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: RoleEnum

Papéis de usuário para controle de acesso.

## Valores

| Valor | Descrição |
|-------|-----------|
| STANDARD | usuário comum |
| PREMIUM | acesso a features beta |
| ADMIN | administrador |

## Permissões por role

| Feature | STANDARD | PREMIUM | ADMIN |
|---------|----------|---------|-------|
| Dashboard | sim | sim | sim |
| Create plans | sim | sim | sim |
| AI planner | sim | sim | sim |
| Multiple goals | não | sim | sim |
| Custom zones | não | sim | sim |
| Export data | não | sim | sim |
| Manage catalog | não | não | sim |

## Usado em

- [[User]] → role field
- Guards (JwtAuthGuard + @Roles)

---

Ver: [[User]], [[_MOC Modelos]]
