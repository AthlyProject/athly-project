---
tags: [camada/backend, tipo/modulo]
camada: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: effort-zones

Zonas de esforço customizadas por usuário.

## Propósito

Armazenar e gerenciar zonas de esforço (HR, pace, RPE) para cada usuário + importação de Strava.

## Controller

Endpoints:
- GET `/effort-zones` — zonas do usuário
- POST `/effort-zones` — criar zona
- PUT `/effort-zones/:id` — atualizar
- DELETE `/effort-zones/:id` — deletar

## Services

- **EffortZonesService**: CRUD
- **StravaZonesImporter**: importa zonas do Strava

## DTOs

- **CreateZoneInput**: name, minHR, maxHR, minPace, maxPace, minRPE, maxRPE
- **ZoneResponse**: id, name, ranges (min/max por métrica)

## Modelos envolvidos

- [[UserEffortZone]] — zona customizada por usuário

## Fluxos

**GET /effort-zones:**
1. Fetch UserEffortZone where userId = user
2. Retorna array de zonas

**POST /effort-zones (import Strava):**
1. Chama StravaService.getAthleteZones(accessToken)
2. Mapeia HR zones Strava → UserEffortZone
3. Persiste com custom names (Z1, Z2, etc.)

## Dependências

- Prisma — UserEffortZone
- strava — importação (opcional)

---

Ver: [[UserEffortZone]], [[AiPlannerService]]
