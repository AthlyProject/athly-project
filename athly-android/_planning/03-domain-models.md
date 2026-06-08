# 03 — Domain models + árvore de segmentos + flatten

## 1. Objetivo
Modelos de domínio (independentes de DTO/JSON) e a lógica de achatar a árvore de segmentos em uma
playlist linear para o tracker — a parte arquitetural mais delicada do app.

## 2. Stack & convenções
Ver `README.md`. Tudo em `domain/model/`. Modelos imutáveis (`data class`), mapeáveis a partir dos DTOs (02).

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Models/ActiveSegment.swift`
  (struct `ActiveSegment` + a extensão `WorkoutSegments.flatten()` — **replicar a lógica de expansão de `set`**)
- `/Users/.../Models/RunSession.swift`, `RoutePoint.swift`, `Split.swift`, `HealthKitRunItem.swift`, `RunWorkoutLink.swift`
- Enums e `Segment`/`WorkoutSegments`/`SegmentTarget` já estão no `02` (DTO) — aqui crie os modelos de domínio
  e os mappers DTO→domínio.

## 4. Alvo Android (`domain/model/`)
- `SportType`, `WorkoutStatus`, `SegmentKind`, `SegmentEndBy`, `SegmentLabel` (enums de domínio + `.label`
  pt-BR, `.emoji`/ícone — espelhar as extensões do iOS `SportType.label/emoji/sfSymbol` → use ícones Material
  ou os mesmos emojis).
- `Segment` (árvore: id, kind, label?, cue?, end?, repetitions?, target?, children?, notes?),
  `WorkoutSegments` (schemaVersion, sport, segments), `SegmentTarget`, `SegmentEndCondition`.
- **`ActiveSegment`** (achatado): id, sourceSegmentId, kind, setIndex?, setTotal?, end, target?, label.
- **`WorkoutSegments.flatten(): List<ActiveSegment>`** — expande nós `set` N vezes, propagando contexto
  (setIndex/setTotal) exatamente como o iOS. Cobrir: árvore aninhada, `set` com filhos, labels.
- `RunSession` (id, startDate, endDate?, distanceMeters, durationSeconds, averagePaceSecondsPerKm,
  elevationGainMeters, caloriesBurned, status, sportType, routePoints[], splits[], backendId?, synced) +
  computeds `distanceKm`, `formattedDistance/Duration/Pace`.
- `RoutePoint` (lat, lon, altitude, timestamp, speed, horizontalAccuracy) ↔ Android `Location`.
- `Split` (kilometer, durationSeconds, distanceMeters, paceSecondsPerKm, elevationDelta) + `formattedPace`.
- `KmSplit` (kilometer, startDate, endDate, distanceMeters, durationSeconds, elevationDelta, paceSecondsPerKm) —
  saída do `SplitCalculator` (prompt 07).
- `HealthRunItem` (startDate, endDate, durationSeconds, distanceMeters, averagePaceSecondsPerKm,
  activeEnergyBurned, elevationGainMeters?).
- `RunWorkoutLink` (healthConnectId, athlyWorkoutId, linkedAt).
- Mappers `*Dto.toDomain()` em `data/mapper/`.

## 5. Contrato de dados
Usa os DTOs do `02`. Defina mappers DTO↔domínio; o resto do app usa só os modelos de domínio.

## 6. Escopo
**In:** modelos + flatten + mappers + formatters de pace/distância/duração (iguais aos `formatted*` do iOS).
**Fora:** Health Connect, networking, UI.

## 7. Dependências
`02-networking-dtos`.

## 8. Critérios de aceite
- `WorkoutSegments.flatten()` produz a MESMA playlist que o iOS para: (a) treino simples (aquecimento→tiros→volta),
  (b) bloco `set` de N repetições (expande N e seta setIndex/setTotal), (c) árvore aninhada. **Escreva testes
  unitários** com um JSON de treino real (pegue um exemplo do backend) comparando a sequência de `ActiveSegment`.
- `formattedPace`/`formattedDistance`/`formattedDuration` batem com o iOS.

## 9. Pitfalls
- A lógica de `flatten` com `set` é a fonte mais provável de divergência — teste à exaustão.
- `SportType.label` é pt-BR; mantenha os textos idênticos.
- Datas: reutilize o serializer tolerante do `02`.
