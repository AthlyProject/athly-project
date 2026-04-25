---
tags: [tipo/onboarding, contexto/produto]
status: done
created: 2026-04-24
---

# Seção 2 — Atividades e Histórico

## Objetivo

Entender que esportes o usuário pratica e sua capacidade atual.

---

## Perguntas

### 1. Que esportes você pratica? (múltiplos)

**Tipo:** Checkbox

- [ ] Corrida (running)
- [ ] Ciclismo (bike)
- [ ] Natação
- [ ] Musculação/Força
- [ ] CrossFit
- [ ] Yoga/Alongamento
- [ ] Caminhada
- [ ] Outro

**Validação:** Mínimo 1 selecionado

**Uso:** `sports` array em UserPreference

---

### 2. Quem prepara seus treinos?

**Tipo:** Radio

- ( ) Eu mesmo (autodidato)
- ( ) Um personal trainer
- ( ) Aplicativos (Strava, Runna, Nike Run)
- ( ) Plano de um amigo
- ( ) Nunca tive treino estruturado

**Uso:** `trainingPreference` em UserPreference

---

### 3. Você consegue correr 3km sem parar?

**Tipo:** Radio (capacidade atual)

- ( ) Sim, com facilidade
- ( ) Sim, mas com dificuldade
- ( ) Não, pauso no meio
- ( ) Não consigo ainda

**Validação:** Obrigatório

**Uso:** `currentCapacity` (boolean ou enum) em UserPreference

---

## Validação

✅ Mínimo 1 esporte selecionado  
✅ Resposta obrigatória em Q2 e Q3  

---

## Próxima: [[Seção 3 - Planejamento]]
