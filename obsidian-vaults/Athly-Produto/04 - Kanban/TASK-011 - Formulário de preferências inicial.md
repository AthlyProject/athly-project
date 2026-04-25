---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 4 - User Preferences"
prioridade: media
---

# TASK-011 — Formulário de Preferências Inicial

## Descrição

Frontend: onboarding form com 7 seções coletando preferências.

## Critérios de Aceite

- [ ] 7 seções: contextualização, atividades, planejamento, performance, PAR-Q, cadastro, aceite
- [ ] Cada seção validada antes de avançar
- [ ] Progress bar visual
- [ ] PAR-Q obrigatório (bloqueia se não validado)
- [ ] POST `/users/preferences` ao final
- [ ] Redirect dashboard se sucesso

## Seções

1. **Contextualização:** já pratica? distância-alvo
2. **Atividades:** esportes, quem prepara, consegue 3km
3. **Planejamento:** dias disponíveis, data início, prazo (max 24 sem)
4. **Performance:** melhor tempo, qualidade sono, dor crônica
5. **PAR-Q:** 7 perguntas screening
6. **Cadastro:** nome, whatsapp, email, nascimento, gênero, peso, altura
7. **Aceite:** termos e privacidade

## Referências

- [[06 - Onboarding/_MOC Onboarding]]
- TASK-010
