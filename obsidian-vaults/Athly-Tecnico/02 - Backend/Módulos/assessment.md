---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: assessment

Avaliação inicial de atletas. 5 sessões RPE-based.

## Propósito

Coletar baseline fitness + preferências + limites (novo atleta).

## Controller

`assessment.controller.ts`

Endpoints:
- GET `/assessment` — status (completo?)
- POST `/assessment` — submeter respostas

## Services

- **AssessmentService**: CRUD, validação de respostas
- **AssessmentPrompt**: prompt genérico (5 sessões)

## DTOs

- **AssessmentInput**: answers[] { sessionId, questions[] { questionId, answer } }
- **AssessmentResponse**: status (complete, incomplete), completedAt, experienceLevel, zones

## Modelos envolvidos

- [[Assessment]] — armazena answers JSON
- [[User]] — marca como assessment_completed

## Fluxos

**GET /assessment:**
1. JwtAuthGuard extrai userId
2. Fetch Assessment where userId = user
3. Se não existe, retorna { status: "incomplete" }
4. Se existe, retorna { status: "complete", completedAt, data }

**POST /assessment:**
1. Cliente POST AssessmentInput (5 sessões de questões)
2. AssessmentService.submitAssessment(userId, answers)
3. Valida estrutura
4. Opcionalmente: chama Assessment Prompt via Gemini para extrair insights (zones, level)
5. Persiste em Assessment table (answers JSON)
6. Marca User como assessment_completed = true
7. Retorna Assessment completo

## 5 Sessões genéricas (RPE-based)

Sessão 1: Experiência de corrida (anos, goal)
Sessão 2: Capacidade aeróbica (distância cômoda, pacing)
Sessão 3: Zonas de esforço (RPE 1-10)
Sessão 4: Limitações físicas (lesões, restrições)
Sessão 5: Preferências (horário, tipo de treino)

## Dependências

- Prisma — Assessment, User
- [[GeminiService]] — análise (opcional)

---

Ver: [[Assessment Prompt]], [[GET assessment]], [[POST assessment]]
