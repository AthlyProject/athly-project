# 19 — Dashboard (home feed)

## 1. Objetivo
Tela inicial: saudação por hora do dia, treino de hoje (com início rápido), progresso semanal %, e barras de
atividade dos últimos 7 dias.

## 2. Stack & convenções
Ver `README.md`. UI em `feature/dashboard/ui/`, `DashboardViewModel` (Hilt). Compose + `StateFlow`.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Dashboard/DashboardView.swift`
  (glows ambientes; `greetingSection` "Olá, {nome}!" + subtítulo por hora; `todayWorkoutSection` com `WorkoutCardView`
  compact + "Iniciar treino agora" / `restDayCard`; `weeklyProgressCard` com %/barra/stats/próximo treino;
  `activityBarsCard` dos últimos 7 dias).
- Dados: `TrainingPlanViewModel` (`todayWorkout`, `weeklyProgress`, `completedThisWeek/totalThisWeek`,
  `nextWorkout`, `allWorkouts`) e `RunStore.sortedSessions` (corridas recentes para as barras).
> Leia por inteiro. Replicar textos pt-BR, os limiares de saudação e o cálculo das barras.

## 4. Alvo Android
### `feature/dashboard/ui/DashboardScreen.kt`
- Fundo `backgroundDark` + 2 `RadialGradient` ambientes (primary @14% topo-esquerda; secondary @8% baixo-direita).
- `LazyColumn`/`Column` com spacing `sm` (16.dp):
  - **Greeting:** card "Olá, {nome ou 'Atleta'}!" (título com gradiente brand) + subtítulo por hora
    (6–12 "Bom dia! Pronto para treinar?" · 12–18 "Boa tarde! Hora do treino?" · senão "Boa noite! Recuperando
    bem?") + avatar circular figure.run. `athlyCard`.
  - **Treino de hoje:** se `todayWorkout != null` → header "Treino de Hoje" (sparkles) + `WorkoutCard(compact = true)`
    (18) + se `scheduled` botão `AthlyGradientButton` "Iniciar treino agora" (navega para a aba Run com o workout
    pendente). `athlyCard(glow = true)`. Senão → `restDayCard` (moon.zzz, "Dia de descanso", "Aproveite para
    recuperar. Amanhã tem mais!").
  - **Progresso semanal:** `athlyInsightCard`. "PROGRESSO SEMANAL" (label, primary). Se `totalThisWeek == 0` →
    "Nenhum treino planejado", senão "{completed} / {total} treinos". Badge "{percent}%" (secondary, seta up).
    Barra de progresso (track surfaceDark + fill gradiente brand, width ∝ `weeklyProgress`, min 8.dp). Stats:
    "Esta Semana" (`completedThisWeek`), "Sequência" (`currentStreak`, ou "-" se `allWorkouts` vazio),
    "Total" (`allWorkouts.count{done}`). Se `nextWorkout`
    → divider + "PRÓXIMO TREINO" + `WorkoutCard(compact = true)`.
  - **Últimos 7 dias:** card "Últimos 7 dias" + total km da semana (secondary, se > 0). 7 barras (D-6..D0): para cada
    dia, soma `distanceKm` das corridas do dia; barra com gradiente brand altura `max(10, km*10)` cap 60.dp se km>0,
    senão trilho vazio 10.dp; label do dia (inicial), hoje em primary/bold.
- Loading: `CircularProgressIndicator` (tint primary) enquanto `isLoading`. Erro: `AlertDialog` "Erro".
- Top bar "Athly". `LaunchedEffect`/`collectAsStateWithLifecycle` dispara o load.

### `feature/dashboard/DashboardViewModel.kt` (`@HiltViewModel`)
- Fontes: treino de hoje + progresso semanal vêm do plano (`WorkoutRepository.getToday()` e o cache/estado do
  `TrainingPlanViewModel`/14 — reusar, não recalcular); corridas recentes via `RunStore`/`HealthConnectManager` (13).
- `UiState`: `userName`, `todayWorkout?`, `nextWorkout?`, `completedThisWeek`, `totalThisWeek`, `weeklyProgress`,
  `totalDone`, `recentRuns: List<RunSession>`, `isLoading`, `errorMessage?`.
- Computeds espelhando o iOS: `weeklyProgress = completed/total` (0 se total 0); barras agrupam corridas por dia
  (`isSameDay`) dos últimos 7 dias.
- Navegação: callback para selecionar a aba Run com `pendingWorkout` (igual ao iOS `selectedTab/pendingWorkout`).

## 5. Contrato de dados
- `GET /workouts/today` → `WorkoutDto?`. Demais dados via estado/cache do plano (14) e corridas (13). Sem endpoints
  novos.

## 6. Escopo
**In:** layout do dashboard, saudação, treino de hoje + início rápido, progresso semanal, barras 7 dias, loading/erro.
**Fora:** plano completo (15), detalhe/conclusão (17), histórico (13), gravação de corrida (07/08).

## 7. Dependências
`14-plan-data`, `18-workout-components`, `13-history-ui`, `01-design-system`.

## 8. Critérios de aceite
- Compila; com plano ativo mostra treino de hoje (ou descanso), progresso "{done}/{total}", % e barra coerentes.
- "Iniciar treino agora" leva à aba Run com o treino pendente.
- Barras dos últimos 7 dias refletem as corridas (Health/RunStore); total km no header quando > 0.
- Saudação muda conforme a hora.

## 9. Pitfalls
- **Não duplicar a lógica do plano:** reusar o estado/cache do `TrainingPlanViewModel` (14) para
  `weeklyProgress`/`todayWorkout`; recalcular leva a divergência.
- Saudação por `LocalTime.now().hour` com os MESMOS limiares (6/12/18).
- Barras: agrupar por dia local (fuso), `max(10, km*10)` com cap 60.dp; hoje destacado.
- "Sequência" (ofensiva) = `currentStreak` do `TrainingPlanViewModel` (port do `StreakCalculator` do iOS):
  treinos prescritos consecutivos concluídos (`done`/`partial`), de hoje pra trás; um `skipped` OU um
  treino passado ainda `scheduled` (não-marcado) quebra; o treino de HOJE pendente é neutro; futuros e
  `sportType == other` são ignorados. Mostrar "-" só quando `allWorkouts` está vazio (sem plano).
- Carregar de forma reativa (`collectAsStateWithLifecycle`); mostrar dados do cache antes do fetch para evitar flash.
