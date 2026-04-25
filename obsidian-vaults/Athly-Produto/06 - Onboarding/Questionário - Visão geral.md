---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Questionário — Visão Geral

## Propósito

Coletar contexto do usuário para gerar planos IA personalizados, mesmo sem Strava.

---

## Fluxo

```
Novo usuário registra
  ↓
Redireciona para onboarding
  ↓
7 seções com progresso visual
  ↓
Cada seção validada antes de avançar
  ↓
Seção 5 (PAR-Q) é bloqueadora
  ↓
POST /users/preferences (salva dados)
  ↓
Redirect dashboard + Modal "Conectar Strava?"
```

---

## Validações por Seção

| Seção | Validação |
| --- | --- |
| **1 - Contextualização** | Pelo menos um checkbox selecionado |
| **2 - Atividades** | Pelo menos 1 esporte; capacidade selecionada |
| **3 - Planejamento** | Pelo menos 1 dia; data + prazo válido; max 24 semanas |
| **4 - Performance** | Tempo em min:seg válido (se preenchido) |
| **5 - PAR-Q** | Obrigatório responder todas 7; se SIM → alert + opção continuar |
| **6 - Cadastro** | Nome (obrigatório), email válido, data nascimento, peso/altura |
| **7 - Aceite** | Checkbox termos = true; opções notificação |

---

## Dados → Banco

```
UserPreference table:
  - distanceTarget (enum)
  - timeFrameWeeks (int)
  - availability (bitmask seg-dom)
  - goals (text)
  - currentCapacity (boolean)
  - sleepQuality (0-10)
  - chronicPain (boolean)
  - trainingPreference (string)

User table:
  - name
  - email
  - whatsapp
  - birthDate
  - gender
  - weight (kg)
  - height (cm)
  
HealthScreening table:
  - parq_q1 → parq_q7 (boolean)
```

---

## UX Notes

- **Progress bar:** Visual no topo (seção X de 7)
- **Back/Next buttons:** Navegação clara
- **Validação in-time:** Mostrar erro imediatamente ao sair campo
- **Mobile-first:** Responsive design
- **Accessibility:** Labels, ARIA, keyboard nav

---

## Referências

- TASK-011
- [[ADR-008 - PAR-Q obrigatório no onboarding]]
- [[ADR-009 - Distância alvo limitada a 24 semanas]]
