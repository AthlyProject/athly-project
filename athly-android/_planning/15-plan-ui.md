# 15 — Plano: UI (lista + calendário)

## 1. Objetivo
Tela do Plano com dois modos (Lista e Calendário) consumindo o `TrainingPlanViewModel` (14). Espelha
`PlanView` + `CalendarGridView` + `CalendarDayCellView` do iOS, pixel a pixel no layout.

## 2. Stack & convenções
Ver `README.md`. `feature/plan/ui/`. Compose + `collectAsStateWithLifecycle`. Strings/cores idênticas ao iOS.

## 3. Referência iOS (espelhar 1:1)
- `/Users/alexandredafonsecajunior/Documents/dev/projects/athly-project/athly-ios/AthlyRunner/Views/Plan/PlanView.swift`
  — toggle segmentado **Lista/Calendário**; título "Plano".
  - **Lista** (`listContent`): header do plano (objetivo, "N semanas", ícones de esportes), `WeeklyGoalInsightCard`
    + `PreviousWeekFeedbackCard` (semana corrente), card de análise (`AnalysisSummaryCard`, abre sheet), botão
    **"Gerar Próxima Semana"** (`sparkles`; "Gerando..." + spinner quando `isGenerating`; gate premium → paywall),
    seção **"Próximos 5 treinos"** (cards compactos, `isNext`, context menu Concluir/Pular; empty state), seletor
    de semana (chips "Sem N", gradiente quando selecionado), **card de stats** (Concluídos `x/y`, Progresso `%`,
    título da meta), lista de treinos da semana (`sportType != .other`). Estados: `emptyPlanState` (sem semanas),
    `noPlanState` (sem plano: "Crie seu plano de corrida" + "Definir meu objetivo" → CreatePlan + "ou" + Gerar).
  - **Calendário** (`calendarContent`): navegação de mês (`chevron.left`/`right` ±1 mês, "Hoje" volta ao mês atual),
    título "MMMM yyyy" capitalizado pt-BR, `CalendarGridView`, e abaixo os treinos do **dia selecionado**
    (`selectedCalendarDate`): título "EEEE, d 'de' MMMM" capitalizado; "Dia de descanso" se vazio; senão cards
    compactos navegáveis para o detalhe.
  - `sheet`s: CreatePlan (16), AnalysisSummary (17/18), `WorkoutCompletionSheet` (concluir com/sem dados de saúde),
    alert de erro. Loading → spinner.
- `/Users/.../Views/Plan/CalendarGridView.swift` — grid 7 colunas; cabeçalho `["Dom","Seg","Ter","Qua","Qui",
  "Sex","Sáb"]`; **42 células** (6 semanas: dias do mês anterior/próximo preenchem as bordas); linhas semanais, cada
  uma com um **banner de meta** opcional (`weekGoalBanner`: `sparkles` + `metrics.title`/`trend`/"Meta da semana",
  e `↩ N%` colorido por `completionRate` se houver `previousWeekAnalysis`); `goalForWeek` casa por intervalo
  `[start,end]`; só conta workouts `sportType != .other`.
- `/Users/.../Views/Plan/CalendarDayCellView.swift` — célula: número do dia (Bold/neon se hoje, círculo de seleção,
  cor `textTertiary` fora do mês), até **3 dots** coloridos por status (`done`→success, `skipped`→error,
  `partial`→warning, `scheduled`→primary); tap só quando há workouts (toggla seleção).

## 4. Alvo Android (`feature/plan/ui/`)
- `PlanScreen.kt` — `Scaffold`/coluna com `SegmentedButton`/toggle Lista|Calendário (estado local
  `rememberSaveable`); consome `PlanUiState` (14) via `collectAsStateWithLifecycle`. Loading → `CircularProgressIndicator`.
  - `planListContent`: header, `WeeklyGoalInsightCard`/`PreviousWeekFeedbackCard` (18), card de análise, botão Gerar
    (gate premium → paywall, 22), "Próximos 5 treinos" (`WorkoutCard` compacto + long-press menu Concluir/Pular),
    `WeekSelector` (chips), `WeekStatsCard`, lista de treinos. Empty/no-plan states com strings idênticas.
  - `planCalendarContent`: `MonthHeader` (±mês, "Hoje"), `CalendarGrid`, `SelectedDayWorkouts`.
- `CalendarGrid.kt` — composable do grid (mês, workouts, weeklyGoals, `selectedDate` hoisted). `LazyVerticalGrid`/
  `Column` de 6 linhas × 7; cabeçalho de dias; `WeekGoalBanner` por linha; **mesma geração de 42 células**
  (1º weekday, dias do mês anterior/próximo) que o iOS.
- `DayCell.kt` — `CalendarDayCell` (dia, isToday, isInMonth, workouts, isSelected, onTap): número estilizado +
  até 3 dots por status; tap só com workouts.
- Reutiliza `WorkoutCard` e `WeeklyGoalInsightCard` / `PreviousWeekFeedbackCard` do **prompt 18**.
- Datas/locale pt-BR via `java.time` + `DateTimeFormatter` (locale `pt-BR`), capitalizado como no iOS.

## 5. Contrato de dados
Sem chamadas diretas — tudo via `TrainingPlanViewModel` (14). Cores/strings/ícones do design system (01) e
componentes do 18.

## 6. Escopo
**In:** `PlanScreen` (lista+calendário), `CalendarGrid`, `DayCell`, `WeekSelector`, `WeekStatsCard`, header, empty/
no-plan states, navegação ao detalhe. **Fora:** criar objetivo (16), detalhe/conclusão (17), os componentes em si (18).

## 7. Dependências
`14` (ViewModel/estado), `18` (`WorkoutCard`, `WeeklyGoalInsightCard`, etc.), `01` (design system).

## 8. Critérios de aceite
- Compila; toggle Lista/Calendário funciona; lista mostra header, próximos 5, seletor de semana, stats e treinos da
  semana iguais ao iOS; calendário mostra grid de 42 células, banners de meta por linha e treinos do dia selecionado.
- Dots de status com as mesmas cores; "Hoje" em negrito/neon; tap em dia sem treino não seleciona.
- Botão Gerar mostra "Gerando..." durante `isGenerating`; no-plan/empty states com os textos pt-BR exatos.

## 9. Pitfalls
- Grid sempre 42 células (6 linhas) — replicar o cálculo de offset do 1º weekday e o preenchimento de meses vizinhos.
- `goalForWeek` casa por intervalo de datas, não por índice — manter.
- Filtrar `sportType != .other` em listas e dots (como o iOS).
- Strings pt-BR idênticas ("Gerar Próxima Semana", "Dia de descanso", "Crie seu plano de corrida", chips "Sem N",
  cabeçalho `Dom..Sáb`, "EEEE, d 'de' MMMM").
- Seleção de dia é toggle (re-tap no mesmo dia limpa).
