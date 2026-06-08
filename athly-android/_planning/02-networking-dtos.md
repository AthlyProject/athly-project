# 02 — Networking + DTOs + Auth/Token store

## 1. Objetivo
Recriar o `APIClient` em Retrofit/OkHttp/kotlinx.serialization: Bearer token, refresh automático em 401,
token store seguro, e TODOS os DTOs e endpoints do backend.

## 2. Stack & convenções
Ver `README.md`. Tudo em `core/network/`, `core/data/` e `data/remote/`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Services/APIClient.swift`
- `/Users/.../AthlyRunner/Models/APIModels.swift` (TODOS os structs)
- `/Users/.../AthlyRunner/Services/KeychainHelper.swift` (token store)
> Leia esses arquivos por inteiro e replique campos/nomes/opcionais com exatidão.

## 4. Alvo Android
### Token store (`core/data/TokenStore.kt`)
- **EncryptedSharedPreferences** (Jetpack Security) — espelha Keychain (`afterFirstUnlock`).
- `save(access, refresh)`, `accessToken()`, `refreshToken()`, `clear()`. Service key: `app.athly.runner.tokens`.

### OkHttp/Retrofit (`core/network/`)
- `AuthInterceptor`: adiciona `Authorization: Bearer <access>` (exceto rotas de auth/refresh).
- `TokenAuthenticator` (OkHttp `Authenticator`): em **401**, chama `POST /auth/refresh` com o refresh token,
  salva os novos tokens, refaz a request com o novo access. Sincronize (evite refresh concorrente).
  Em falha de refresh → limpa tokens e emite um evento global de "sessão expirada" (StateFlow/Channel) que o
  `AuthViewModel` (prompt 04) observa para deslogar.
- `Json { ignoreUnknownKeys = true; isLenient = true }` + `retrofit2-kotlinx-serialization-converter`.
- `BuildConfig.BASE_URL`. Timeout padrão 30s; **120s** especificamente para `plan-from-health`.
- `NetworkModule` (Hilt) provê OkHttp, Retrofit e os `ApiService`.

### ApiService (Retrofit interfaces — `data/remote/ApiService.kt`)
Endpoints (base `https://api.athlyproject.app`):

| Método | Rota | Retorno |
|---|---|---|
| POST | `/auth/login` | `AuthResponse` |
| POST | `/auth/register` | `AuthResponse` |
| POST | `/auth/refresh` | `RefreshResponse` |
| GET | `/users/me` | `UserProfileDto` |
| PUT | `/users/profile` | `UserProfileDto` |
| DELETE | `/users/me` | — |
| GET | `/training-plans/me` | `TrainingPlanDto?` (200 ou 204/null) |
| GET | `/weekly-goals/training-plan/{id}` | `List<WeeklyGoalDto>` |
| GET | `/workouts/today` | `WorkoutDto?` |
| GET | `/workouts/training-plan/{id}` | `List<WorkoutDto>` |
| PATCH | `/workouts/{id}/complete` | `WorkoutDto` (body opcional `CompleteWorkoutRequest`) |
| PATCH | `/workouts/{id}/skip` | `WorkoutDto` |
| POST | `/workouts/{id}/feedback` | — (`WorkoutFeedbackRequest`) |
| POST | `/goals` | `CreateGoalResponse` (`CreateGoalRequest`) |
| GET | `/goals/active` | `CreateGoalResponse?` |
| POST | `/ai-planner/plan-from-health` | `AiPlannerResponse` (timeout 120s) |
| GET | `/weekly-goals/{id}/admin-report` | `AdminWeeklyReportDto` |

### DTOs (`data/remote/dto/`) — espelhar `APIModels.swift`
Enums: `SportType`(running,cycling,swimming,strength,crossfit,triathlon,duathlon,yoga,walking,other),
`WorkoutStatus`(scheduled,done,skipped,partial), `WeeklyGoalStatus`(PLANNED,GENERATED,CANCELLED,LOCKED),
`SegmentKind`(warmup,work,recovery,cooldown,rest,set,unknown), `SegmentEndBy`(distanceM,durationSec,reps),
`SegmentLabel`(warmup,easy,tempo,rep,rec,cooldown).
Structs (todos com campos opcionais → nullable Kotlin): `LoginRequest`, `RegisterRequest`, `AuthResponse`,
`RefreshRequest/RefreshResponse`, `UserProfileDto`, `WorkoutDto` (id,date,sportType,title,description?,blocks[],
segments?,status,trainingPlanId?,weeklyGoalId?,intensity?,isGoalAttempt?,stravaActivityId?
[manter no DTO só por paridade de contrato; **não expor na UI** — Strava fora até o lançamento]),
`WorkoutBlockDto` (type,duration?,distance?,targetPace?,instructions?), `SegmentDto` (id,kind,label?,cue?,end?,
repetitions?,target?,children?,notes?), `SegmentTargetDto` (paceSecPerKmMin/Max,hrZone,rpe,powerWattsMin/Max,
cadenceRpm,strokeType,poolLengthM,targetSecPer100m,exercise,reps,loadKg,loadPctOf1RM,tempoSec,restAfterSec —
todos opcionais), `SegmentEndConditionDto` (by,value), `WorkoutSegmentsDto` (schemaVersion,sport,segments[]),
`TrainingPlanDto`, `WeeklyGoalDto` (+ `WeeklyGoalMetrics`, `PreviousWeekAnalysis`), `RunAnalysisDto`,
`HealthRunPayload`, `SegmentPayload` (label,index?,distanceKm,durationSeconds,avgPaceSecondsPerKm?,avgHR?,
peakHR?,endHR?), `DetailedSessionPayload` (…, segments[], splitsSource?), `PlanFromHealthRequest`
(runs[],detailedSessions?,weekStartDate?), `AiPlannerResponse`, `ParsedGoal`, `CreateGoalRequest/Response`,
`UpdateProfileRequest`, `WorkoutFeedbackRequest`, `CompleteWorkoutRequest`, Admin DTOs.

### Repositories (`data/repository/`)
`AuthRepository`, `UserRepository`, `PlanRepository`, `WorkoutRepository`, `GoalRepository`,
`AiPlannerRepository` — encapsulam o `ApiService`, retornam `Result<T>`/`Flow`. Datas: serializer custom
ISO8601 **com fallback `yyyy-MM-dd`** (vários campos vêm sem hora). JSON é **snake_case**: configure
`@SerialName` ou `namingStrategy = SnakeCase`.

## 5. Contrato de dados
Toda a tabela de endpoints acima + DTOs. Bater 1:1 com o backend (`athly-backend`).

## 6. Escopo
**In:** networking completo, DTOs, repositories, token store, refresh. Um teste manual: `login()` retorna tokens.
**Fora:** UI (telas vêm no 04+).

## 7. Dependências
`00-foundation`.

## 8. Critérios de aceite
- Compila; `AuthRepository.login(email,pass)` autentica contra o backend e persiste tokens.
- Uma chamada autenticada (`/users/me`) funciona com o Bearer; ao expirar, o `TokenAuthenticator` renova e refaz.
- `plan-from-health` usa timeout de 120s.
- DTOs desserializam o JSON real do backend (snake_case, campos opcionais ausentes não quebram).

## 9. Pitfalls
- Não faça refresh concorrente (sincronize no Authenticator; trate o caso de refresh inválido → logout).
- Campos opcionais do backend → **nullable** + defaults; `ignoreUnknownKeys = true`.
- `targetPace` vem como string "M:SS"; mantenha string no DTO e converta no domínio.
- Datas inconsistentes (ISO8601 com/sem fração, ou `yyyy-MM-dd`): serializer tolerante.
