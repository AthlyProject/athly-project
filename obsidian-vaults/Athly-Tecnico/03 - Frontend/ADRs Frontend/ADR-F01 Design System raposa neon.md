---
tags: [tipo/adr, camada/frontend, tema/design-system]
tipo: adr
camada: frontend
status: implementado
created: 2026-04-24
---

# ADR-F01 — Design System "raposa neon"

## Status
aceito

## Contexto
O Athly precisa de identidade visual própria que traduza "IA moderna + esporte + performance". Migração vinha de estilos Tailwind genéricos (sky-600, slate-700) espalhados pelo código, com inconsistências entre telas.

## Decisão
Criar Design System centralizado em `src/design-system/tokens.ts` + variáveis CSS em `src/index.css`. Paleta **dark-first** com gradientes azul→roxo e efeitos **glow neon**. Identidade "raposa neon" como mascote e linguagem visual.

- Primary azul: `#0284c7` → neon `#00d4ff`
- Secondary roxo: `#a855f7` → neon `#bf40ff`
- Background dark: `#0a0a0f`
- Tipografia: DM Sans (corpo) + Space Grotesk (títulos)
- 10 componentes base + 2 layout

## Consequências

### Positivas
- Consistência visual entre as 14 telas
- Troca de tema via CSS vars (1 ponto de mudança)
- Identidade única e memorável

### Negativas
- Curva de aprendizado para devs habituados a Tailwind puro
- Menos flexibilidade ad-hoc (precisa seguir tokens)

### Trade-offs
- Escolhemos branding forte sobre neutralidade genérica

## Alternativas consideradas
- **Chakra UI** — descartado: override de tema complicado, identidade genérica
- **shadcn/ui** — descartado: muito associado a estética "GitHub"
- **Tailwind puro sem tokens** — descartado: inconsistência comprovada

## Referências
- [[_MOC Design System]]
- [[Tokens de cor]]
- [[Componentes Base]]
- [[Gradientes e glows]]
