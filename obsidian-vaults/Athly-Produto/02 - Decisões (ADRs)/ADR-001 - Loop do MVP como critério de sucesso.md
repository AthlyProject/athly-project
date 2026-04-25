---
tags: [tipo/adr, contexto/produto, status/aceito]
status: done
created: 2026-04-24
adr_number: 1
---

# ADR-001 — Loop do MVP como Critério de Sucesso

## Status
**Aceito** — Critério foundational para MVP

## Contexto

Existem várias visões sobre o que constitui um MVP de sucesso para o Athly:
- Alguns acreditam que apenas um plano genérico (Assessment Plan) é suficiente
- Outros entendem que a IA é o core (ignorar Strava)
- Visão escolhida: Loop fechado automático é o diferencial

**Visão escolhida:** O loop **Conectar → Sincronizar → Gerar → Exibir → Repetir** é o critério de sucesso, porque fecha a realimentação.

## Decisão

O MVP não é bem-sucedido até que:

1. **Conectar:** Usuário consegue fazer OAuth com Strava
2. **Sincronizar:** Sistema busca automaticamente últimos 30 dias
3. **Gerar:** IA recebe histórico real e cria plano personalizado
4. **Exibir:** Dashboard mostra plano com badges (Strava/IA/Manual)
5. **Repetir:** Cron automático todo seg 6h resincroniza e regenera

Todas as 5 etapas **devem estar funcionando** para MVP ser "done".

## Consequências

### Positivas
✅ Diferenciador claro versus apps genéricos  
✅ Usuário sente valor realmente (não plano canned)  
✅ Feedback loop contínuo melhora fidelidade  
✅ Dados para futuras melhorias (user behavior)  

### Negativas
❌ Complexidade maior (Strava + IA + Cron)  
❌ Prazo MVP mais longo  
❌ Mais pontos de falha (API Strava, IA, agendador)  

### Trade-offs
- **Fast MVP vs completo:** Escolhemos completo (não apenas Assessment Plan)
- **Automação vs manual:** Automação add complexidade, mas é o diferencial

## Alternativas Consideradas

### 1. Apenas Assessment Plan (5 treinos genéricos)
- ❌ Não usa Strava (perde histórico)
- ❌ Plano sempre igual para todos
- ❌ Falha em proposta de valor

### 2. Assessment + Strava opcional (sem cron)
- ❌ Usuário precisa clicar "Regenerar" manualmente
- ❌ Sem automação, fidelidade cai

### 3. Loop parcial (sin cron de IA)
- ❌ Strava sincroniza, mas IA não regenera automaticamente
- ❌ Manutenção manual ainda necessária

---

## Referências

- [[Visão do Produto]]
- [[Loop do MVP]]
- [[Proposta de Valor]]
- MVP_PRD.md (fonte)
