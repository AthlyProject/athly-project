---
tags: [tipo/adr, camada/frontend, tema/validacao]
tipo: adr
camada: frontend
status: implementado
created: 2026-04-24
---

# ADR-F04 — React Hook Form + Zod para formulários

## Status
aceito

## Contexto
Assessment, Login/Register, Workout edit e Feedback são formulários com validação complexa (PARQ obrigatório, senha confirmada, blocos inline). Precisamos validar no client e refletir erros rapidamente sem re-renders desnecessários.

## Decisão
Combinar **React Hook Form 7** (uncontrolled inputs, performance) com **Zod 4** (schemas de validação, inferência de tipos). Schemas Zod espelham DTOs do backend sempre que possível.

## Consequências

### Positivas
- Type inference do schema para o form (`z.infer<typeof Schema>`)
- Menos re-renders (uncontrolled)
- Validação declarativa e reutilizável
- Erros de validação formatados em 1 ponto

### Negativas
- Duas bibliotecas para aprender
- Schemas Zod duplicam alguma informação do backend (DTOs)

### Trade-offs
- DX e performance > ter uma única fonte de verdade

## Alternativas consideradas
- **Formik + Yup** — descartado: mais re-renders, Yup sem inferência tão forte
- **Validação manual** — descartado: não escala
- **Compartilhar schemas via monorepo** — adiado: MVP tem frontend e backend em repos separados

## Referências
- [[AssessmentPage]]
- [[WorkoutPage]]
- [[FeedbackPage]]
- [[Cliente OpenAPI gerado]]
