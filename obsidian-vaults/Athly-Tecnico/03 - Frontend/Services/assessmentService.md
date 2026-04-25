---
tags: [tipo/servico, camada/frontend, dominio/onboarding]
tipo: servico
camada: frontend
arquivo: src/services/assessmentService.ts
status: implementado
created: 2026-04-24
---

# assessmentService

## Propósito
Enviar as respostas do questionário de onboarding (PAR-Q, objetivos, performance, disponibilidade) para o backend.

## API pública

| Método | Endpoint |
|--------|----------|
| `submitAssessment(input)` | [[POST assessment]] |
| `getAssessment()` | [[GET assessment]] |

## Consumido por
- [[AssessmentPage]] (via [[AssessmentGuard]])

## Fluxo
1. [[AssessmentPage]] coleta respostas (React Hook Form + Zod)
2. `submitAssessment(answers)` → backend
3. Backend marca `user.assessmentCompleted = true`
4. [[useAuthStore]] atualizado
5. Redirect para `/app/dashboard`

## Shape do payload
Segue [[SubmitAssessmentDto]] — JSON com seções PARQ, Goals, PhysicalActivity, PerformanceHealth.

## Notas
- Após completo, [[AssessmentGuard]] deixa de bloquear rotas
- [[PAR-Q]] (ver vault de Produto) é bloqueante — respostas positivas exigem atenção médica
