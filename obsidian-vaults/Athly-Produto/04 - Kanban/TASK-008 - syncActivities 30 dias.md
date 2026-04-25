---
tags: [tipo/task, contexto/produto, status/todo]
status: todo
created: 2026-04-24
epico: "Épico 3 - Strava Sync Service"
prioridade: alta
---

# TASK-008 — syncActivities 30 Dias

## Descrição

Implementar lógica de sync que busca últimos 30 dias de Strava e upserda Workouts.

## Critérios de Aceite

- [ ] Calcula `after = now() - 30 dias` (unix timestamp)
- [ ] Chama Strava API: `GET /athlete/activities?after=...&per_page=200`
- [ ] Para cada atividade:
  - Mapeia modalidade (Run → running, etc.)
  - Cria/atualiza Workout com stravaActivityId UNIQUE
  - source = "strava"
- [ ] Retorna lista de workouts inseridos
- [ ] Log para debug (count, duração)
- [ ] Testes com mock activities

## Mapeamento Modalidades

Run, TrailRun → running  
Ride, VirtualRide → cycling  
Swim → swimming  
WeightTraining → strength  
CrossFit → crossfit  
Walk, Hike → walking  
Yoga → yoga  

## Referências

- [[ADR-007 - Janela de 30 dias para histórico Strava]]
- [[Strava - Mapeamento de esportes]]
- TASK-007
