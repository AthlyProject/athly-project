---
tags: [moc, home]
type: moc
status: implementado
created: 2026-04-24
---

# Athly Técnico — Home

Bem-vindo ao vault técnico do Athly. Documentação centralizada das 3 camadas.

## Visão geral

```
Frontend (React)         Backend (NestJS)          iOS (SwiftUI)
  |                          |                         |
  +------- REST API ----------+---------- gRPC --------+
  |       + OAuth Strava      |      + HealthKit       |
  |                          |                         |
  +------------ Gemini AI Planning (AiPlannerService) -+
```

## Mapa de conteúdo

| Área | MOC | Descrição |
|------|-----|-----------|
| Backend | [[_MOC Backend]] | Módulos, modelos Prisma, endpoints REST, IA/Prompts, ADRs |
| Frontend | [[_MOC Frontend]] | Telas, design system, stores, services, ADRs |
| iOS | [[_MOC iOS]] | Views, ViewModels, services, Live Activity, observabilidade |
| Cross-cutting | [[_MOC Cross-cutting]] | Auth flow, Strava flow, AI planner, correlação |

## ADRs por camada

```dataview
TABLE camada, status FROM "" WHERE tipo = "adr" SORT camada, file.name ASC
```

## Contadores

```dataview
TABLE tipo, length(rows) AS "Quantidade"
FROM ""
FLATTEN tipo
GROUP BY tipo
SORT tipo ASC
```

## Últimas 10 notas

```dataview
TABLE file.name, file.ctime AS "Criado", status
FROM ""
SORT file.ctime DESC
LIMIT 10
```

---

**Setup recomendado:** abrir o graph (Ctrl+G), procurar por "auth" ou "workout" para explorar conexões.

