---
tags: [camada/backend, tipo/enum]
camada: backend
tipo: enum
status: implementado
created: 2026-04-24
---

# Enum: IntegrationType

Provedores de integração suportados.

## Valores

| Valor | Descrição |
|-------|-----------|
| strava | Strava (atividades, segmentos) |
| garmin | Garmin Connect |
| apple_health | Apple HealthKit |
| other | outro provedor |

## Suporte atual

- **strava**: fully integrated (24 tools)
- **garmin**: planejado
- **apple_health**: iOS nativo (sem backend integration)
- **other**: placeholder

## Usado em

- [[Integration]] → type field

---

Ver: [[Integration]], [[strava]], [[_MOC Modelos]]
