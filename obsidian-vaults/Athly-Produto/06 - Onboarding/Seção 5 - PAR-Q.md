---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 5 — PAR-Q

**SEÇÃO BLOQUEADORA — Obrigatório responder antes de avançar**

---

## Propósito

Physical Activity Readiness Questionnaire: screening de risco pré-exercício.

Responsabilidade legal + segurança do usuário.

---

## As 7 Perguntas

### 1. Você foi diagnosticado com doença cardíaca?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 2. Você tem pressão arterial elevada (hipertensão)?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 3. Você tem colesterol elevado?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 4. Você tem diabetes ou açúcar elevado no sangue?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 5. Você tem problemas ósseos ou articulares (artrite, osteoporose)?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 6. Você sofre com tosse frequente ou falta de ar?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

### 7. Existe algum motivo médico que te impedisse de fazer exercício?

**Tipo:** Radio

- ( ) Não
- ( ) Sim
- ( ) Não tenho certeza

---

## Lógica de Bloqueio

**Se qualquer resposta = SIM:**

```
⚠️ Alert:
"Você indicou resposta SIM em uma ou mais perguntas.
Consulte um médico antes de iniciar um programa de exercícios."

[Botão] Consultar médico (link externo?)
[Botão] Entendo e quero continuar
[Botão] Cancelar
```

**Se clica "Entendo e quero continuar":**
- Continua onboarding (assume risco)
- Salva `parqAlertAcknowledged = true`

---

## Validação

✅ Todas 7 perguntas obrigatoriamente respondidas  
✅ Não pode avançar sem responder todas  

---

## Armazenamento

```
HealthScreening table:
  parq_q1, parq_q2, ..., parq_q7 (boolean)
  parqAlertAcknowledged (boolean)
  createdAt
```

---

## Referências

- [[ADR-008 - PAR-Q obrigatório no onboarding]]
- Próxima: [[Seção 6 - Cadastro e dados físicos]]
