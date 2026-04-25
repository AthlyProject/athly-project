---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 1 — Contextualização

## Objetivo

Entender se usuário já pratica corrida e qual é a meta de distância.

---

## Perguntas

### 1. Você já pratica corrida regularmente?

**Tipo:** Checkbox (múltiplas respostas permitidas)

- [ ] Sim, corro 2-3x por semana
- [ ] Sim, mas inconsistentemente (1x/mês ou menos)
- [ ] Não, sou iniciante absoluto
- [ ] Nunca corri, mas quero começar

**Uso:** Contexto de experiência para IA

---

### 2. Qual é sua meta principal de distância?

**Tipo:** Radio (apenas 1)

- ( ) 5km (primeiro milestone)
- ( ) 10km (meia distância)
- ( ) 21.1km (meia maratona) ← Popular
- ( ) 42.2km (maratona)
- ( ) Outra: [texto]

**Validação:** Seleção obrigatória

**Uso:** `distanceTarget` em UserPreference

---

## Validação

✅ Pelo menos um checkbox em Q1 selecionado  
✅ Exatamente 1 radio selecionado em Q2  

---

## Próxima: [[Seção 2 - Atividades e histórico]]
