---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 3 — Planejamento

## Objetivo

Definir disponibilidade de treino, data de início e prazo para atingir meta.

---

## Perguntas

### 1. Quais dias você está disponível para treinar?

**Tipo:** Checkbox (seg-dom)

- [ ] Segunda
- [ ] Terça
- [ ] Quarta
- [ ] Quinta
- [ ] Sexta
- [ ] Sábado
- [ ] Domingo

**Validação:** Mínimo 1 dia selecionado

**Uso:** `availability` (bitmask) em UserPreference

---

### 2. Em que data você quer começar?

**Tipo:** Date picker

**Default:** Hoje

**Validação:** Data não pode ser no passado

**Uso:** `startDate` em TrainingPlan

---

### 3. Em quantas semanas você quer correr [distanceTarget]?

**Tipo:** Number input

**Range:** 1-24 semanas (máximo 6 meses)

**Validação:** 
- ✅ Número inteiro, ≥1, ≤24
- ✅ Se > 24, erro: "Máximo 24 semanas (6 meses). Refine sua meta."

**Uso:** `timeFrameWeeks` em UserPreference

---

### 4. Tem uma data específica para correr [distanceTarget]?

**Tipo:** Date picker (opcional)

**Validação:**
- Se preenchido: deve estar dentro de 24 semanas
- Se > 24 semanas do hoje, erro

**Uso:** `targetDate` em UserPreference

---

## Validação

✅ Mínimo 1 dia selecionado  
✅ startDate não no passado  
✅ timeFrameWeeks 1-24  
✅ targetDate (se preenchido) ≤ 24 semanas  

---

## Próxima: [[Seção 4 - Performance e saúde]]
