---
tags: [tipo/integracao, integracao/strava, contexto/produto]
status: done
created: 2026-04-24
---

# Strava — Mapeamento de Esportes

Tabela de conversão entre tipos de atividade Strava e modalidades Athly.

---

## Tabela Completa

| Strava Type | Athly Modalidade | Descrição |
| --- | --- | --- |
| Run | **running** | Corrida em trilha ou rua |
| TrailRun | **running** | Corrida em trilha (conta como running) |
| Ride | **cycling** | Bike outdoor |
| VirtualRide | **cycling** | Bike em simulador (Zwift, etc.) |
| MountainBikeRide | **cycling** | Mountain bike |
| Swim | **swimming** | Natação em piscina ou mar |
| SkiAlpine | **skiing** | Esqui alpino |
| SkiBackcountry | **skiing** | Esqui backcountry |
| SkiNordic | **skiing** | Esqui nórdico |
| Snowboard | **skiing** | Snowboard |
| Hike | **walking** | Caminhada |
| Walk | **walking** | Caminhada |
| Workout | **strength** | Treino genérico (força, HIIT) |
| WeightTraining | **strength** | Musculação |
| CrossFit | **crossfit** | CrossFit |
| RockClimbing | **other** | Escalada (esporte não coberto) |
| Yoga | **yoga** | Yoga |
| Pilates | **yoga** | Pilates (similiar a yoga) |
| Stretching | **yoga** | Alongamento |
| Handcycle | **cycling** | Ciclo manual |
| Rowing | **swimming** | Remo (similar a natação) |
| StairStepper | **strength** | Escada (similar a strength) |
| Elliptical | **other** | Elíptica (não é running) |
| InlineSkate | **other** | Patins inline |
| Badminton | **other** | Badminton |
| Basketball | **other** | Basquete |
| Ultras | **running** | Ultramaratona (é running) |
| Roller Ski | **skiing** | Roller skiing |
| *Outros* | **other** | Fallback padrão |

---

## Regras de Normalização

1. **Modalidades multi-esporte:** Run, Ride, Swim são primárias
2. **Esportes similares:** Agrupar em categorias (Hike + Walk = walking)
3. **Esportes não-suportados:** Fallback a **other**
4. **Strava types futuros:** Defaultar a **other** (sem erro)

---

## Uso em Backend

```typescript
const modalityMap: Record<string, string> = {
  "Run": "running",
  "TrailRun": "running",
  "Ride": "cycling",
  // ...
};

function mapStravaToModality(stravaType: string): string {
  return modalityMap[stravaType] || "other";
}
```

---

## Impacto na IA

A modalidade é usada pela IA para:
- Distribuir treinos apropriados (não pedir 3 runs se usuário só faz bike)
- Considerar multiesportismo
- Calcular volume (distância vs duração variam por modalidade)

---

## Referências

- TASK-008
- [[Strava - Sync de atividades]]
