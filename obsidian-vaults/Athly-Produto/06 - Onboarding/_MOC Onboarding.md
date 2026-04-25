---
tags: [tipo/moc, contexto/produto]
status: done
created: 2026-04-24
---

# MOC — Onboarding

Questionário de onboarding em 7 seções coletando preferências do usuário.

## Seções (7 total)

| # | Seção | Link | Descrição |
| --- | --- | --- | --- |
| **1** | Contextualização | [[Seção 1 - Contextualização]] | Já pratica? Distância-alvo? |
| **2** | Atividades | [[Seção 2 - Atividades e histórico]] | Esportes, quem prepara, capacidade |
| **3** | Planejamento | [[Seção 3 - Planejamento]] | Dias disponíveis, data início, prazo |
| **4** | Performance | [[Seção 4 - Performance e saúde]] | Melhor tempo, sono, dor crônica |
| **5** | PAR-Q | [[Seção 5 - PAR-Q]] | 7 perguntas screening (obrigatório) |
| **6** | Cadastro | [[Seção 6 - Cadastro e dados físicos]] | Nome, email, peso, altura, etc. |
| **7** | Aceite | [[Seção 7 - Termos e aceite]] | Privacidade, termos, notificações |

---

## Overview

[[Questionário - Visão geral]] — Descrição do fluxo, validações, uso dos dados

---

## Fluxo

```
Novo usuário
  ↓
[Progress bar]
  ↓
Seção 1 → Seção 2 → Seção 3 → Seção 4 → Seção 5 (bloqueador) → Seção 6 → Seção 7
  ↓ (cada seção validada)
POST /users/preferences
  ↓
Redirect: Dashboard → Modal "Conectar Strava?" → Gerar plano
```

---

## Dados Coletados

**Preferências:**
- distanceTarget (5/10/21.1/42.2 km)
- timeFrameWeeks (1-24)
- availability (seg-dom)
- goals (texto)
- currentCapacity (consegue correr 3km?)
- sleepQuality (0-10)
- chronicPain (sim/não)
- trainingPreference (quem prepara?)

**Cadastro:**
- name, email, whatsapp
- birthDate, gender
- weight (kg), height (cm)

**PAR-Q (7 perguntas):**
- Histórico cardíaco?
- Pressão alta?
- Colesterol alto?
- Diabetes?
- Problemas ósseos/articulações?
- Tosse/falta de ar frequente?
- Outro motivo médico?

---

## Referências

- TASK-010, TASK-011
- [[ADR-008 - PAR-Q obrigatório no onboarding]]
- [[ADR-009 - Distância alvo limitada a 24 semanas]]
