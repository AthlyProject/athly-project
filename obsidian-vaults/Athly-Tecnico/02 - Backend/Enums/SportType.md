---
tags: [camada/backend, tipo/enum]
camada: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: SportType

Tipos de esporte suportados pelo Athly.

## Valores

| Valor | Descrição |
|-------|-----------|
| running | corrida em estrada |
| cycling | ciclismo |
| swimming | natação |
| strength | musculação/força |
| crossfit | crossfit |
| triathlon | triathlon |
| duathlon | duathlon |
| yoga | yoga |
| walking | caminhada |
| other | outro |

## Usado em

- User → prefer sportType
- TrainingPlan → sportType principal
- Workout → sportType de cada workout
- Strava mapping → traduz tipos Strava para Athly

## Strava mapping

```
Run, TrailRun → running
Ride, VirtualRide → cycling
Swim → swimming
WeightTraining → strength
CrossFit → crossfit
Walk, Hike → walking
Yoga → yoga
* → other
```

---

Ver: [[Stack Backend]], [[_MOC Modelos]]
