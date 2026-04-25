---
tags: [tipo/epico, contexto/produto]
status: todo
created: 2026-04-24
---

# Épico 4 — User Preferences

## Descrição

Coletar e validar preferências do usuário para geração IA: goals, availability, performance, dados físicos, PAR-Q.

## Tasks Relacionadas

- [[TASK-010 - Validar goals e availability]]
- [[TASK-011 - Formulário de preferências inicial]]

## Critérios de Aceite

✅ Formulário onboarding coleta 7 seções (contextualização, atividades, planejamento, performance, PAR-Q, cadastro, aceite)  
✅ Validações: distanceTarget ≤ 24 semanas, availability dia-a-dia, goals não vazios  
✅ PAR-Q obrigatório (7 perguntas screening)  
✅ Dados salvos em `User` + `UserPreference` table  
✅ Dados retornados via GET `/users/me/preferences`  

## Dependências

Paralelo com [[Épico 3 - Strava Sync Service]]

---

**Roadmap:** [[03 - Épicos/_MOC Épicos]]
