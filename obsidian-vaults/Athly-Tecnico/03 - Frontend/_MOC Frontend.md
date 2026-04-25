---
tags: [camada/frontend, tipo/moc]
camada: frontend
tipo: moc
status: implementado
created: 2026-04-24
---

# Frontend — MOC

React 19 + TypeScript + Vite + TailwindCSS + Zustand. 14 telas, design system "raposa neon".

## Documentos principais

- [[Stack Frontend]] — tech, versões
- [[Telas/]] → [[_MOC Telas]] — 14 rotas
- [[Design System/]] → [[_MOC Design System]] — tokens, componentes
- [[Stores Zustand/]] — useAuthStore, useWorkoutStore, useToastStore
- [[Rotas e Guards]] — ProtectedRoute, AssessmentGuard
- [[Cliente OpenAPI gerado]] — auto-generated API client

## Telas (14)

```dataview
TABLE rota, acesso FROM "03 - Frontend/Telas" WHERE tipo = "tela" SORT file.name
```

## ADRs Frontend

```dataview
TABLE status FROM "03 - Frontend/ADRs Frontend" WHERE tipo = "adr" SORT file.name
```

---

**Comece por**: [[Stack Frontend]] → [[_MOC Design System]] → choose uma tela
