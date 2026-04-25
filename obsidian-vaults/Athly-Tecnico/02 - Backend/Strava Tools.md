---
tags: [camada/backend, tipo/documento]
camada: backend
tipo: documento
status: implementado
created: 2026-04-24
---

# Strava Tools (24)

24 ferramentas de integração Strava (atividades, segmentos, rotas, atleta).

## Lista completa

### Atividades (7)
1. connectStrava — OAuth handshake
2. getRecentActivities — últimas N atividades
3. getAllActivities — fetch completo (paginado)
4. getActivityDetails — detalhe (splits, power, etc.)
5. getActivityLaps — laps da atividade
6. getActivityPhotos — fotos anexadas
7. getActivityStreams — lat/lng/altitude/pace/power

### Atleta (5)
8. getAthleteProfile — perfil
9. getAthleteStats — stats agregadas
10. getAthleteZones — zonas Strava
11. listAthleteClubs — clubes
12. listAthleteRoutes — rotas salvas

### Rotas (3)
13. getRoute — detalhe rota
14. exportRouteGpx — export GPX
15. exportRouteTcx — export TCX

### Segmentos (6)
16. getSegment — detalhe segmento
17. getSegmentEffort — effort pessoal
18. listSegmentEfforts — efforts do atleta
19. listStarredSegments — favoritados
20. starSegment — favoritar
21. exploreSegments — explorar perto

### Utilitários (4)
22. getServerVersion — versão API Strava
23. planNextWeek — integração AI planner
24. formatWorkoutFile — formata para Workout model

## Mapeamento SportType

- Run/TrailRun → running
- Ride/VirtualRide → cycling
- Swim → swimming
- WeightTraining → strength
- CrossFit → crossfit
- Walk/Hike → walking
- Yoga → yoga
- * → other

---

Ver: [[strava]], [[integrations]], [[AiPlannerService]]
