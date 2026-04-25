---
tags: [camada/frontend, tipo/documento]
camada: frontend
tipo: documento
status: implementado
created: 2026-04-24
---

# Stack Frontend

## Versões

| Tech | Versão |
|------|--------|
| React | 19.2.0 |
| TypeScript | 5.9.3 |
| Vite | 7.2.4 |
| React Router | 7.13.0 |
| Zustand | 5.0.11 |
| TailwindCSS | 4.1.18 |
| Zod | 4.3.6 |
| React Hook Form | 7.71.1 |
| React Hot Toast | 2.6.0 |
| Lucide React | latest |

## Arquitetura

```
src/
├── pages/ (14 rotas)
├── components/ (base + page-specific)
├── stores/ (Zustand)
├── services/ (API calls)
├── hooks/ (custom hooks)
├── utils/ (helpers)
├── types/ (TypeScript interfaces)
├── styles/ (TailwindCSS + CSS vars)
└── design-system/ (componentes base)
```

## Design System "raposa neon"

Dark-first, gradientes azul→roxo, glow neon.

### Cores

| Token | Cor | Uso |
|-------|-----|-----|
| primary-400 | #0ea5e9 | accent |
| primary-500 | #0284c7 | main |
| primary-neon | #00d4ff | glow |
| secondary-500 | #a855f7 | highlight |
| secondary-neon | #bf40ff | glow |
| background-dark | #0a0a0f | bg principal |
| surface-card | #1a1a24 | cards |
| text-primary | #f9fafb | texto |
| text-secondary | #d1d5db | subtle |

### Tipografia

- **Body**: DM Sans
- **Headings**: Space Grotesk

---

Ver: [[_MOC Design System]], [[_MOC Frontend]]
