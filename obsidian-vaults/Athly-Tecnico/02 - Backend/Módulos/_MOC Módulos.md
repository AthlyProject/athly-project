---
tags: [camada/backend, tipo/moc]
camada: backend
tipo: moc
status: implementado
created: 2026-04-24
---

# Módulos Backend — MOC

13 módulos NestJS, organizados por responsabilidade.

## Módulos

```dataview
TABLE FROM "02 - Backend/Módulos" WHERE tipo = "modulo" SORT file.name
```

## Grupos

### Core (Auth + Users)
- [[auth]] — login, register, JWT
- [[users]] — perfil, profile update

### Treinamento (planos, objetivos, workouts)
- [[workouts]] — CRUD, feedback, status
- [[training-plans]] — plano de treino
- [[weekly-goals]] — objetivo semanal

### Integração
- [[integrations]] — suporte genérico (Strava, Garmin)
- [[strava]] — 24 tools de sincronismo
- [[equipments]] — equipamentos

### IA & Avaliação
- [[ai-planner]] — geração de planos via Gemini
- [[assessment]] — avaliação inicial
- [[effort-zones]] — zonas de esforço
- [[goals]] — objetivos de usuário

### Outros
- [[waitlist]] — fila beta

---

**Cada módulo tem**: Controller, Service, DTOs, Endpoints relacionados, Dependências.

