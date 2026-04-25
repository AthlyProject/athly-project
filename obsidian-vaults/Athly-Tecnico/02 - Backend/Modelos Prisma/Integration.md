---
tags: [camada/backend, tipo/modelo]
camada: backend
tipo: modelo
status: implementado
created: 2026-04-24
---

# Modelo: Integration

Armazena OAuth tokens e metadata para integrações (Strava, Garmin, etc.).

## Propósito

Manter credentials de terceiros de forma segura + rastreamento de sync.

## Campos

| Campo | Tipo | Nullable | Descrição |
|-------|------|----------|-----------|
| id | UUID | false | PK |
| userId | UUID | false | FK User |
| type | IntegrationType | false | strava, garmin, apple_health, other |
| accessToken | String | false | OAuth access (encryptado?) |
| refreshToken | String | true | OAuth refresh (se aplicável) |
| expiresAt | DateTime | true | validade do access token |
| metadata | JSON | true | { athleteId, accountName } |
| lastSyncedAt | DateTime | true | último sincronismo |
| isConnected | Boolean | false | default: true |
| createdAt | DateTime | false | default: now() |
| updatedAt | DateTime | false | default: now() |

## Relações

- N:1 User

## Enums relacionados

- [[IntegrationType]] — strava, garmin, apple_health, other

## Usado em

- [[POST integrations-id-connect]] → cria Integration
- [[POST ai-planner-plan-next-week]] → fetch Strava activities
- [[GET integrations]]

## Notas

- Tokens devem ser encriptados em DB
- isConnected = soft disconnect (não deleta)
- lastSyncedAt: rastreia sincronismo automático
- metadata: store arbitrary per-provider data

---

Ver: [[strava]], [[integrations]], [[_MOC Modelos]]
