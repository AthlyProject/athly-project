---
tags: [camada/backend, tipo/modulo]
camala: backend
tipo: modulo
status: implementado
created: 2026-04-24
---

# Módulo: integrations

Gerenciar integrações com plataformas (Strava, Garmin, Apple Health).

## Propósito

CRUD de Integration (armazena OAuth tokens) + orquestração de sincronismo.

## Controller

`integrations.controller.ts`

Endpoints:
- GET `/integrations` — listar integrações do usuário
- POST `/integrations/:id/connect` — conectar (OAuth callback)
- DELETE `/integrations/:id/disconnect` — desconectar

## Services

- **IntegrationsService**: CRUD, validação de tokens
- **StravaService**: sincronismo (ver [[strava|módulo strava]])

## DTOs

- **ConnectInput**: code (do OAuth provider)
- **IntegrationResponse**: id, type (strava, garmin), isConnected, lastSync

## Modelos envolvidos

- [[Integration]] — armazena tokens e metadata

## Enums

- **IntegrationType**: strava, garmin, apple_health, other

## Fluxos

**POST /integrations/strava/connect:**

1. Frontend: redirect OAuth Strava
2. Strava: callback com `code`
3. Frontend: POST `/integrations/strava/connect?code=XXX`
4. IntegrationsService.connectStrava(userId, code)
5. Troca code por access_token + refresh via Strava API
6. Armazena em Integration table
7. Opcionalmente: sync imediato de atividades
8. Retorna Integration { type: "strava", isConnected: true }

**GET /integrations:**
1. Fetch Integration where userId = user
2. Retorna array com status de cada integração

## Dependências

- Prisma — Integration
- strava — sincronismo (24 tools)

---

Ver: [[strava]], [[Integration]], [[POST integrations-id-connect]]
