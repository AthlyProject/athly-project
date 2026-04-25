---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 4 — Performance e Saúde

## Objetivo

Coletar dados de performance atual e saúde para contextualizar geração IA.

---

## Perguntas

### 1. Qual seu melhor tempo em 10km?

**Tipo:** Text input (formato: HH:MM:SS ou MM:SS)

**Exemplo:** "00:50:30" ou "50:30"

**Validação (opcional):** Se preenchido, deve ser válido

**Uso:** `best10kTime` em UserPreference (para calcular ritmo esperado)

---

### 2. Qual sua qualidade de sono? (0-10)

**Tipo:** Slider / Number input (0=péssimo, 10=excelente)

**Default:** 7

**Validação:** 0-10

**Uso:** `sleepQuality` em UserPreference (afeta recuperação)

---

### 3. Você tem dor crônica em alguma parte do corpo?

**Tipo:** Radio

- ( ) Não, nenhuma
- ( ) Sim, joelho
- ( ) Sim, coluna/costas
- ( ) Sim, tornozelo
- ( ) Sim, outro: [texto]

**Uso:** `chronicPain` em UserPreference (IA evita movimentos lesivos)

---

### 4. Qual seu objetivo principal? (resumo)

**Tipo:** Textarea (100-500 chars)

**Placeholder:** "Ex: Correr 21.1km em 2h30min, melhorar saúde, emagrecer 5kg"

**Validação:** 
- ✅ Não vazio
- ✅ Min 10 chars, max 500

**Uso:** `goals` text em UserPreference

---

## Validação

✅ Tempo 10km válido (se preenchido)  
✅ sleepQuality 0-10  
✅ goals 10-500 chars  

---

## Próxima: [[Seção 5 - PAR-Q]] (BLOQUEADORA)
