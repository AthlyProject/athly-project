# 14 — Plano: dados + ViewModel + cache

## 1. Objetivo
`TrainingPlanViewModel` que carrega o plano (cache-first → refresh), monta as semanas a partir dos workouts
achatados, gera a próxima semana via Health Connect (`plan-from-health`) e conclui/pula treinos. Espelha o
`TrainingPlanViewModel` do iOS.

## 2. Stack & convenções
Ver `README.md`. `feature/plan/`. `@HiltViewModel` + `StateFlow<PlanUiState>`. Repositories do 02. Cache via
DataStore/Room. A lógica de semanas deve bater 1:1 com o iOS.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/ViewModels/TrainingPlanViewModel.swift`
  — `loadData()`: hidrata do cache (se houver, **não** mostra loading), `getMyTrainingPlan()` (nil → sem plano),
  depois em paralelo `getWeeklyGoals(planId)`, `getWorkoutsByTrainingPlan(planId)`, `getTodayWorkout()`;
  `weeklyGoals` ordenadas por `parsedStartDate`; `weeks = buildWeeks(goals, workouts)`; `selectedWeekIndex =
  currentWeekIndex()`; `lastAnalysis = weeklyGoals.last?.metrics?.asRunAnalysis`; persiste cache; reagenda notifs.
  - `buildWeeks`: para cada goal (enumerado), filtra workouts por `weeklyGoalId == goal.id`, ordena por
    `parsedDate`, monta `Week(id, number = index+1, weeklyGoal, workouts)`.
  - `currentWeekIndex`: semana cujo `[startDate, endDate]` contém hoje; senão última.
  - Computeds: `currentWeekWorkouts`, `completedThisWeek`/`totalThisWeek`/`weeklyProgress`, `nextWorkout`
    (1º `scheduled` da semana), `currentWeekGoal`, `nextFiveWorkouts` (≥ hoje, `sportType != .other`, ordenados, top 5),
    `currentStreak` (port do `StreakCalculator` do iOS — treinos `done`/`partial` consecutivos de hoje pra trás;
    `skipped`/passado-não-marcado quebra; hoje pendente é neutro; `other`/futuros ignorados).
  - `generateNextWeekWithHealth()`: `isGenerating = true`; lê Health Connect (read auth + `fetchLatestRunningWorkouts(20)`);
    monta `HealthRunPayload`s; **`detailedSessions`** via `buildDetailedSessions(limit: plan == nil ? 5 : 7)`
    (raw sessions → `WorkoutDetailFetcher`/`buildDetailedSession` resolvendo o link via `RunWorkoutLinkStore`);
    `PlanFromHealthRequest(runs, detailedSessions?, weekStartDate: nil)` → `planFromHealth`; `lastAnalysis =
    response.analysis`; `loadData()`; `selectedWeekIndex = última`. **Sem corridas** → runs vazias (cold start
    /assessment no backend). **Timeout (120s)** → `pollUntilNewWorkouts` (18× a cada 5s, recarrega até surgir
    workout novo).
  - `completeWorkout` / `completeWorkoutWithHealthData(link + UUID/dist/duração)` / `skipWorkout` → `replaceWorkout`
    (atualiza `allWorkouts`/`todayWorkout`, rebuild semanas, persiste cache).
- `/Users/.../Services/TrainingPlanCache.swift` — snapshot Codable `{trainingPlan, weeklyGoals, allWorkouts,
  todayWorkout, lastAnalysis, updatedAt}` persistido em JSON; `load()`/`save()`/`upsertWorkout()`/`clear()`.

## 4. Alvo Android (`feature/plan/`)
- `TrainingPlanViewModel.kt` — `@HiltViewModel`, `StateFlow<PlanUiState>`. Injeta `PlanRepository`,
  `WorkoutRepository`, `GoalRepository`(weekly-goals), `AiPlannerRepository` (02) e `HealthConnectManager` (12).
  - `PlanUiState`: `plan?`, `weeks: List<Week>`, `todayWorkout?`, `allWorkouts: List<Workout>`, `weeklyGoals`,
    `selectedWeekIndex`, `isLoading`, `isGenerating`, `errorMessage?`, `lastAnalysis?` + computeds derivados
    (currentWeekWorkouts, completed/total/progress, nextWorkout, currentWeekGoal, nextFiveWorkouts).
  - `loadData()`: cache-first (hidrata e **não** liga loading se há cache), GET plano (null → estado sem plano),
    paralelo (`coroutineScope`/`async`) goals+workouts+today, ordenar goals, `buildWeeks`, `selectedWeekIndex`,
    persistir cache. Tratar `notFound`/cancelamento como o iOS.
  - `buildWeeks(goals, workouts)` e `currentWeekIndex()` — **idênticos ao iOS** (agrupar por `weeklyGoalId`,
    `number = index+1`, ordenar por data; semana corrente = contém hoje, senão última).
  - `generateNextWeek()` (= `generateNextWeekWithHealth`): via `HealthConnectManager.readRunningSessions(20)` +
    `buildDetailedSession` (12) montando `PlanFromHealthRequest`; chama `AiPlannerRepository.planFromHealth`
    (timeout 120s, 02); em timeout → polling (18×/5s). Sem device/permissão → runs vazias.
  - `completeWorkout(w)` / `completeWorkoutWithHealthData(w, run)` (linka via `RunWorkoutLinkStore` + passa
    `appleHealthWorkoutUUID`=id HC, dist, duração) / `skipWorkout(w)` → `replaceWorkout` + persistir cache.
- `Week` (domínio, `domain/model/`): `id, number, weeklyGoal?, workouts`.
- `TrainingPlanCache.kt` (`core/data/`) — snapshot offline via **DataStore (JSON kotlinx) ou Room**:
  `{plan?, weeklyGoals, allWorkouts, today?, lastAnalysis?, updatedAt}`; `load()`/`save()`/`upsertWorkout()`/`clear()`.

## 5. Contrato de dados
`GET /training-plans/me`, `/weekly-goals/training-plan/{id}`, `/workouts/training-plan/{id}`, `/workouts/today`,
`PATCH /workouts/{id}/complete|skip`, `POST /ai-planner/plan-from-health` (02). Payloads de saúde via 12.

## 6. Escopo
**In:** ViewModel + estado + cache + build de semanas + gerar (health) + complete/skip + polling. **Fora:** UI (15),
criar objetivo / `/goals` (16), detalhe/feedback de treino (17).

## 7. Dependências
`02` (repos/DTOs/endpoints), `03` (modelos/`Week`), `12` (Health Connect p/ payload).

## 8. Critérios de aceite
- Compila; com plano no backend, a tela carrega semanas agrupadas por `weeklyGoalId`, semana corrente selecionada,
  `nextWorkout`/`nextFiveWorkouts`/progresso iguais ao iOS.
- Cache-first: 2ª abertura mostra dados na hora (sem spinner) e refaz fetch em background.
- `generateNextWeek()` envia `runs` + `detailedSessions` corretos; em timeout (>120s) entra em polling e aparece a
  nova semana; concluir/pular reflete na lista e no cache.

## 9. Pitfalls
- `plan-from-health` é lento (**120s** de timeout, 02); mostre `isGenerating` e trate timeout com polling — não dê erro.
- Cache-first then refresh: não ligar loading quando já há snapshot (espelha o iOS).
- `buildWeeks`/`currentWeekIndex` são a fonte provável de divergência — replicar agrupamento/ordenação exatos.
- Sem corridas / sem permissão de saúde → enviar `runs` vazias (cold start), não abortar.
- `detailedSessions` = null quando vazio (não `[]`); `appleHealthWorkoutUUID` carrega o id do Health Connect.
