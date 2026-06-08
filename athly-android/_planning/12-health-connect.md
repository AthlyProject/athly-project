# 12 — Health Connect (ler/gravar/detalhar corridas)

## 1. Objetivo
Recriar a camada de saúde do iOS (HealthKit) em **Health Connect**: ler corridas existentes, gravar uma
corrida finalizada (sessão + rota + calorias + distância), e montar o `DetailedSessionPayload` por segmento
(splits + HR) que alimenta o `plan-from-health`. É a fatia de plataforma mais pesada do port.

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/health/`. `androidx.health.connect:connect-client`. Suspend functions +
`Result<T>`. Registros usam `Instant`/`ZoneOffset` (não `Date`). Mapeamento de plataforma: **HealthKit → Health Connect**.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/HealthKitService.swift`
  — auth de leitura (workoutType, workoutRoute, heartRate); auth de escrita (workoutType, activeEnergyBurned,
  distanceWalkingRunning); `saveWorkout(result:)` constrói um `HKWorkout` `.running`/`.outdoor` com samples de
  energia+distância e metadata `activeDurationSeconds`/`averagePaceSecondsPerKm`; `fetchLatestRunningWorkouts(limit)`
  → `[HealthKitRunItem]` (filtro `.running`, sort por endDate desc); `fetchLatestRawRunningWorkouts(limit)` retorna
  os workouts brutos p/ o detalhador. `map(_:)`: distance, `activeDurationSeconds` (fallback `duration`),
  pace de metadata ou derivado, energia em kcal, `elevationGainMeters = nil`.
- `/Users/.../Services/WorkoutDetailFetcher.swift` — `buildDetailedSession(for:athlyWorkoutId:)` → `DetailedSessionPayload`.
  **Cadeia de fallback de 3 níveis (`splitsSource`)**: `events` (`HKWorkoutEvent` `.segment`/`.lap`, ≥2 → ranges com
  distância proporcional + heurística rep/rec/warmup/cooldown) > `route` (`HKWorkoutRoute` → `CLLocation[]` →
  `SplitCalculator.kmSplits` → splits reais de 1km, label `.easy`) > `synthetic` (1 segmento por km a partir de
  total dist/duração, label `.easy`). HR por segmento via `summarizeHR(from:to:)` → `avg/peak/end`; HR global idem.
  Pace por segmento = `durationSeconds / (distanceMeters/1000)`.
- `/Users/.../Services/PermissionGate.swift` — pede cada permissão **uma vez por instalação**, com chaves
  versionadas em `UserDefaults` (`permission.healthkit.read.requested.v1`, `...write...v1`).
- `/Users/.../Models/HealthKitRunItem.swift` — modelo de apresentação (já portado no 03 como `HealthRunItem`).
- `/Users/.../Models/RunWorkoutLink.swift` + `/Users/.../Services/RunWorkoutLinkStore.swift` — mapa local
  `HKWorkout.uuid → Workout.id` persistido em JSON; `link()`, `athlyWorkoutId(for:)`, `allOrphanCandidates()`.

> Leia esses arquivos por inteiro. Replique a cadeia de fallback e as constantes da heurística com exatidão.

## 4. Alvo Android (`core/health/`)
### `HealthConnectManager.kt`
Wrapper sobre `HealthConnectClient.getOrCreate(context)`.
- **Disponibilidade:** `HealthConnectClient.getSdkStatus(context)` → trate `SDK_UNAVAILABLE` e
  `SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED` (manda instalar/atualizar o APK do Health Connect via Play Store).
  Espelha `isHealthDataAvailable` (que era `false` no simulador → aqui `false` quando provider ausente).
- **Permissões (read):** `ExerciseSessionRecord`, `HeartRateRecord`, `ExerciseRoute` (via
  `HealthPermission.getReadPermission(...)` + permissão de rota), `TotalCaloriesBurnedRecord`, `DistanceRecord`.
  **(write):** `ExerciseSessionRecord`, `ExerciseRoute` (write route), `TotalCaloriesBurnedRecord`, `DistanceRecord`.
- `readRunningSessions(limit: Int = 20): List<HealthRunItem>` — `readRecords(ExerciseSessionRecord)` filtrando
  `exerciseType == EXERCISE_TYPE_RUNNING`, `TimeRangeFilter` aberto, ordenado por fim desc, `pageSize`/limit.
  Para cada sessão agrega `DistanceRecord` (soma metros) e `TotalCaloriesBurnedRecord` (kcal) na janela da sessão;
  duração = `endTime - startTime` (use metadata se gravada por nós); pace derivado quando ausente. Mapeia →
  `HealthRunItem` (03). `id` = `record.metadata.id`.
- `saveRun(result: RunResult)` — escreve **um** `ExerciseSessionRecord(EXERCISE_TYPE_RUNNING)` com
  `startTime/endTime` (+ `ZoneOffset`), `exerciseRoute` (de `result.routePoints` → `ExerciseRoute.Location`
  com lat/lon/altitude/time), e registros `DistanceRecord` + `TotalCaloriesBurnedRecord` na mesma janela.
  Metadata (`activeDurationSeconds`, `averagePaceSecondsPerKm`): Health Connect **não tem metadata livre** como o
  HKWorkout — persista esses extras no nosso store local (Room/DataStore) indexado pelo `record.metadata.id`,
  e leia de volta em `readRunningSessions`/`buildDetailedSession`. Retorna o id do registro criado.
- `fetchLatestRawRunningSessions(limit): List<ExerciseSessionRecord>` — equivalente ao raw fetch p/ o detalhador.
- `buildDetailedSession(session, athlyWorkoutId): DetailedSessionPayload?` — **mesma cadeia 3-tier**:
  - `events`: laps de exercício. Health Connect expõe `ExerciseSessionRecord.segments` (`ExerciseSegment`) e
    `laps` (`ExerciseLap`) — quando presentes (≥2) use-os como o iOS usa `HKWorkoutEvent`. **Normalmente ausentes**
    em sessões de terceiros → cai para route/synthetic.
  - `route`: `session.route` (`ExerciseRoute`) → `List<RoutePoint>` → **`SplitCalculator.kmSplits` (07)** → splits de 1km.
  - `synthetic`: 1 segmento por km de total dist/duração (mesmas regras do iOS: km cheios + sobra > 50m, label `.easy`).
  - HR: `readRecords(HeartRateRecord)` na janela da sessão; some por segmento (`avg/peak/end`) e global.
  - Monta `SegmentPayload` (02) e `DetailedSessionPayload` (02) com `splitsSource = events|route|synthetic`.

### `PermissionGate` (`core/health/HealthPermissionGate.kt`)
Equivalente via **DataStore**: chaves versionadas (`permission.health.read.requested.v1`,
`...write...v1`) para pedir cada conjunto uma vez. O fluxo de UI usa o **rationale activity** especial do
Health Connect (`ActivityResultContracts.requestPermissions` da `PermissionController` /
`PermissionController.createRequestPermissionResultContract()`), mais a checagem de `getGrantedPermissions()`.

### `RunWorkoutLinkStore` (`core/data/...`)
Mapa `healthConnectId → athlyWorkoutId` via **DataStore (JSON) ou Room**. API: `link(healthConnectId, athlyWorkoutId)`,
`athlyWorkoutId(for:)`, `allOrphanCandidates(ids)`. Modelo `RunWorkoutLink` (03): `healthConnectId, athlyWorkoutId, linkedAt`.

### DI
`HealthModule` (Hilt) provê `HealthConnectClient`, `HealthConnectManager`, `HealthPermissionGate`, `RunWorkoutLinkStore`.

### Mapeamento de plataforma
| HealthKit | Health Connect |
|---|---|
| `HKWorkout(.running)` | `ExerciseSessionRecord(EXERCISE_TYPE_RUNNING)` |
| `HKWorkoutRoute` / `CLLocation` | `ExerciseRoute` / `ExerciseRoute.Location` |
| `activeEnergyBurned` / `distanceWalkingRunning` | `TotalCaloriesBurnedRecord` / `DistanceRecord` |
| `heartRate` samples | `HeartRateRecord` (samples por instante) |
| `workoutEvents` (`.segment`/`.lap`) | `ExerciseSegment` / `ExerciseLap` (quase sempre ausentes) |
| metadata livre no `HKWorkout` | store local (Room/DataStore) indexado pelo `record.metadata.id` |
| `HKHealthStore.isHealthDataAvailable` | `HealthConnectClient.getSdkStatus` |
| `Date` | `Instant` + `ZoneOffset` |

## 5. Contrato de dados
Saída p/ o backend: `HealthRunPayload`, `SegmentPayload`, `DetailedSessionPayload`, `PlanFromHealthRequest` (02).
**Atenção ao nome do campo:** o payload de sessão tem `appleHealthWorkoutUUID` (mantém o nome no JSON,
snake_case `apple_health_workout_uuid`) — no Android ele carrega o **`record.metadata.id` do Health Connect**.
`splitsSource ∈ {events, route, synthetic}` (string). Datas ISO8601 com fração (`yyyy-MM-dd'T'HH:mm:ss.SSSXXX`).

## 6. Escopo
**In:** `HealthConnectManager` (ler/gravar/detalhar), `HealthPermissionGate`, `RunWorkoutLinkStore`, DI, modelos
de saída reutilizando os payloads do 02. **Fora:** UI de histórico (13), telas de permissão polidas (mínimo
funcional aqui), consumo no plano (14).

## 7. Dependências
`02` (payloads/DTOs), `03` (`HealthRunItem`/`RoutePoint`/`RunWorkoutLink`), `07` (`SplitCalculator`).

## 8. Critérios de aceite
- Compila; em device com Health Connect: `readRunningSessions(20)` retorna corridas (Apple Watch-equivalente,
  Garmin/Nike via HC) com distância/duração/pace/calorias coerentes.
- `saveRun()` grava um `ExerciseSessionRecord(RUNNING)` visível no app Health Connect, com rota + distância + calorias.
- `buildDetailedSession()` produz `splitsSource = route` quando há rota, `synthetic` quando só há totais; os
  km-splits batem com o `SplitCalculator` do 07 (mesmo pace).
- Permissões pedidas uma única vez (gate versionado); negação não derruba a leitura (segue sem dados).

## 9. Pitfalls
- **Disponibilidade:** em Android antigo/sem provider, Health Connect não existe → cheque `getSdkStatus` e mande
  instalar o APK; nunca assuma presença.
- **Permissões = rationale activity especial:** use o contrato da `PermissionController`; declare as permissões no
  Manifest e a activity de rationale (`androidx.health.connect.action.SHOW_PERMISSIONS_RATIONALE`).
- **Rota costuma faltar** em sessões de terceiros (Garmin/Nike sincronizadas) → quase sempre cai no **synthetic**;
  o backend trata `synthetic` como pace de preenchimento (não interpretar como ritmo real) — é a realidade de
  dados do projeto, mantenha o fallback honesto.
- `ExerciseSegment`/`laps` quase nunca vêm de terceiros → não conte com `events`.
- `Instant`/`ZoneOffset` em tudo; nada de `Date`/`Calendar` aqui. Some HR só dentro da janela `[start,end]` do segmento.
- HC não tem metadata livre: persista `activeDurationSeconds`/`averagePaceSecondsPerKm` no store local senão a
  duração ativa (descontando pausas) se perde na releitura.
