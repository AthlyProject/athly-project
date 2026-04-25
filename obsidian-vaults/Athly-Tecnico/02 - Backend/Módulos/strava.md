---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: strava

24 ferramentas de integração Strava. Síncrono de atividades, análise de segmentos, planejamento de rotas.

## Propósito

Wrapper de Strava API com 24 tools para sincronismo de runs, análise e planejamento.

## Services

- **StravaService**: orquestração, token refresh, rate limit

## 24 Tools

### Atividades (7)
1. **connectStrava** — OAuth handshake
2. **getRecentActivities** — últimas N atividades
3. **getAllActivities** — fetch completo (paginado)
4. **getActivityDetails** — detalhe de atividade (splits, power, etc.)
5. **getActivityLaps** — laps da atividade
6. **getActivityPhotos** — fotos anexadas
7. **getActivityStreams** — streams (lat/lng/altitude/pace/power)

### Atleta (5)
8. **getAthleteProfile** — perfil do atleta
9. **getAthleteStats** — estatísticas agregadas
10. **getAthleteZones** — zonas de esforço Strava
11. **listAthleteClubs** — clubes do atleta
12. **listAthleteRoutes** — rotas salvas

### Rotas (2)
13. **getRoute** — detalhe rota
14. **exportRouteGpx** — export GPX
15. **exportRouteTcx** — export TCX

### Segmentos (6)
16. **getSegment** — detalhe segmento
17. **getSegmentEffort** — effort pessoal em segmento
18. **listSegmentEfforts** — efforts do atleta em um segmento
19. **listStarredSegments** — segmentos favoritados
20. **starSegment** — favoritar segmento
21. **exploreSegments** — explorar segmentos perto

### Utilitários (4)
22. **getServerVersion** — versão API Strava
23. **planNextWeek** — integração com AI planner (vê atividades Strava passadas)
24. **formatWorkoutFile** — formata atividade para Workout model

## Mapeamento de SportType

| Strava Type | Athly SportType |
|-----------|----------|
| Run | running |
| TrailRun | running |
| Ride | cycling |
| VirtualRide | cycling |
| Swim | swimming |
| WeightTraining | strength |
| CrossFit | crossfit |
| Walk | walking |
| Hike | walking |
| Yoga | yoga |
| * | other |

## Fluxos

**Sincronismo pós-OAuth:**
1. Usuário conecta Strava
2. IntegrationsService.connectStrava() chama StravaService.connect()
3. StravaService.getRecentActivities(accessToken)
4. Para cada atividade: formatWorkoutFile() → persiste em Workout (opcional)

**Geração de plano com Strava:**
1. AiPlannerService.planNextWeek()
2. Chama StravaService.getAthleteStats(userId)
3. Retorna distância total, volume por tipo, zonas
4. Monta prompt com histórico
5. Gemini gera plano considerando runs passadas

## Dependências

- Strava API (OAuth)
- integrations — armazena tokens

---

Ver: [[integrations]], [[Strava Flow (backend + frontend)]]
