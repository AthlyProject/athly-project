---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 6 — Cadastro e Dados Físicos

## Objetivo

Coletar dados pessoais e antropométricos do usuário.

---

## Perguntas

### 1. Nome completo

**Tipo:** Text input

**Validação:** Obrigatório, min 3 chars, max 100

**Uso:** `User.name`

---

### 2. Email

**Tipo:** Email input

**Validação:** 
- ✅ Obrigatório
- ✅ Formato válido (RFC 5322 simplificado)
- ✅ Único (não pode duplicar)

**Uso:** `User.email` (login)

---

### 3. WhatsApp (opcional)

**Tipo:** Text input (tel)

**Exemplo:** "+55 11 99999-9999"

**Validação:** Se preenchido, deve ser válido

**Uso:** `User.whatsapp` (notificações)

---

### 4. Data de Nascimento

**Tipo:** Date picker

**Validação:**
- ✅ Obrigatório
- ✅ Data no passado
- ✅ Mínimo 16 anos (legal de esporte)
- ✅ Máximo 120 anos

**Uso:** `User.birthDate` → calcula idade

---

### 5. Gênero

**Tipo:** Radio (ou select)

- ( ) Masculino
- ( ) Feminino
- ( ) Outro
- ( ) Prefiro não informar

**Validação:** Obrigatório

**Uso:** `User.gender` (personalização IA)

---

### 6. Peso (kg)

**Tipo:** Number input

**Range:** 30-300 kg

**Validação:**
- ✅ Obrigatório
- ✅ Número válido, 30-300

**Uso:** `User.weight` (cálcio de calorias, progressão)

---

### 7. Altura (cm)

**Tipo:** Number input

**Range:** 120-250 cm

**Validação:**
- ✅ Obrigatório
- ✅ Número válido, 120-250

**Uso:** `User.height` (IMC, referência progressão)

---

## Validação Integrada

✅ Nome 3-100 chars  
✅ Email válido e único  
✅ WhatsApp válido (se preenchido)  
✅ Data nascimento válida, mínimo 16 anos  
✅ Gênero selecionado  
✅ Peso 30-300  
✅ Altura 120-250  

---

## Próxima: [[Seção 7 - Termos e aceite]]
