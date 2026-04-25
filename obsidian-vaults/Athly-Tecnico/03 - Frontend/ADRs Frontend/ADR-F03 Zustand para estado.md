---
tags: [tipo/adr, camada/frontend, tema/estado]
tipo: adr
camada: frontend
status: implementado
created: 2026-04-24
---

# ADR-F03 — Zustand para gerenciamento de estado

## Status
aceito

## Contexto
A aplicação precisa compartilhar estado entre telas (usuário autenticado, treino do dia, toasts). Re-renders em Context API eram perceptíveis no Dashboard.

## Decisão
Usar **Zustand 5** com 3 stores distintos por responsabilidade:
- [[useAuthStore]] — com `persist` middleware em `localStorage` (key `iafit-auth`)
- [[useWorkoutStore]] — estado de treino em memória
- [[useToastStore]] — fila de toasts (integra com `react-hot-toast`)

Auto-restauração de token no boot via `api.setToken()` a partir do persisted state.

## Consequências

### Positivas
- Boilerplate mínimo (3 linhas para um store)
- Type-safe com TypeScript
- Performance: só componentes que leem o slice re-renderizam
- Sem Provider wrapping

### Negativas
- Menos opiniativo que Redux — decisões de estrutura ficam com o time
- Ferramentas de devtool menos maduras que Redux DevTools

### Trade-offs
- Simplicidade > ecossistema

## Alternativas consideradas
- **Redux Toolkit** — descartado: overkill para 3 stores pequenos
- **Context API** — descartado: re-renders globais no Dashboard
- **Jotai / Recoil** — descartados: modelo atômico adicionaria complexidade sem ganho claro

## Referências
- [[useAuthStore]]
- [[useWorkoutStore]]
- [[useToastStore]]
