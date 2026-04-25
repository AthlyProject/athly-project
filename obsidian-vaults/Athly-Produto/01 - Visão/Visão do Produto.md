---
tags: [tipo/visao, contexto/produto]
status: done
created: 2026-04-24
---

# Visão do Produto — Athly

## Uma Frase

**Athly é um personal trainer inteligente que aprende com o histórico real de treinos do atleta (via Strava) e gera planos semanais personalizados usando IA.**

## Problema

Corredores iniciantes e intermediários enfrentam:
- Falta de orientação personalizada (treinos genéricos)
- Dificuldade em estruturar progressão (sem feedback do histórico)
- Pouca integração entre apps (Strava existe, mas plano vem de fora)
- Cansaço em atualizar planos manualmente

## Solução

Loop fechado **Conectar → Sincronizar → Gerar → Exibir → Repetir:**
1. **Conectar** Strava via OAuth
2. **Sincronizar** últimos 30 dias de atividades
3. **Gerar** plano IA baseado no histórico + preferências do usuário
4. **Exibir** plano com badges Strava/IA/Manual
5. **Repetir** automaticamente toda segunda-feira (6h)

## Proposta de Valor Única

| Atributo | Versus outros apps |
| --- | --- |
| **Dados reais + IA** | Não sincroniza Strava automaticamente + planos genéricos |
| **Loop fechado** | Recomeça do zero a cada semana |
| **Regeneração automática** | Manual, trabalhoso |
| **Distinção visual** | Sem badges de origem |

## Público-Alvo

- Corredores 5km → 21.1km (meia maratona)
- Usuários Strava, Runna, Nike Run, Adidas Run
- Metas: emagrecer, melhorar saúde, vencer desafios pessoais
- Tech-savvy, confortável com OAuth e IA

## Sucesso (Critérios MVP)

✅ Loop Conectar → Sincronizar → Gerar → Exibir → Repetir funcionando  
✅ Planos gerados por IA com contexto real (Strava)  
✅ Regeneração automática semanal  
✅ Badges visuais Strava/IA/Manual  
✅ Fallback Assessment Plan sem Strava  

---

**Relacionado:** [[Proposta de Valor]], [[Loop do MVP]], [[Personas]]
