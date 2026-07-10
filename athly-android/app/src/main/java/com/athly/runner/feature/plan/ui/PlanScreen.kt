package com.athly.runner.feature.plan.ui

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.component.athlyInsightCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.mapper.parsedLocalDate
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.TrainingPlanDto
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import com.athly.runner.feature.common.AnalysisSummaryCard
import com.athly.runner.feature.common.AnalysisSummarySheet
import com.athly.runner.feature.common.WorkoutCard
import com.athly.runner.feature.common.icon
import com.athly.runner.feature.paywall.ui.PaywallScreen
import com.athly.runner.feature.plan.PlanUiState
import com.athly.runner.feature.plan.TrainingPlanViewModel
import com.athly.runner.feature.workout.ui.WorkoutCompletionSheet
import com.athly.runner.feature.workout.ui.WorkoutDetailScreen
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Aba Plano — espelha `PlanView` do iOS: toggle Lista/Calendário, header do plano, análise da IA,
 * "Gerar Próxima Semana", próximos 5 treinos, seletor de semana + stats + treinos; calendário com
 * grid de 42 células e treinos do dia selecionado.
 * Pendências de outras fatias: gate premium do Gerar (22), detalhe do treino/WorkoutCompletionSheet (17),
 * banner de trial (22).
 */
@Composable
fun PlanScreen(viewModel: TrainingPlanViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var viewMode by rememberSaveable { mutableStateOf(0) } // 0 = Lista, 1 = Calendário
    var showAnalysisSheet by remember { mutableStateOf(false) }
    var showCreatePlan by rememberSaveable { mutableStateOf(false) }
    var showPaywall by rememberSaveable { mutableStateOf(false) }
    var detailWorkout by remember { mutableStateOf<WorkoutDto?>(null) }
    var workoutToComplete by remember { mutableStateOf<WorkoutDto?>(null) }

    LaunchedEffect(Unit) { viewModel.loadData() }

    if (showPaywall) {
        // Gate premium do Gerar (22) — cosmético enquanto o paywall está desligado (fail-open).
        PaywallScreen(onDismiss = { showPaywall = false })
        return
    }

    if (showCreatePlan) {
        // Tela "Novo Plano" (prompt 16) — cobre a aba, como o sheet full-screen do iOS.
        CreatePlanScreen(planViewModel = viewModel, onDismiss = { showCreatePlan = false })
        return
    }

    detailWorkout?.let { workout ->
        // Detalhe do treino (prompt 17) — cobre a aba, como o push do NavigationStack do iOS.
        WorkoutDetailScreen(
            workout = workout,
            onDismiss = { detailWorkout = null },
            onComplete = { workoutToComplete = workout },
            onSkip = {
                viewModel.skipWorkout(workout)
                detailWorkout = null
            },
        )
        workoutToComplete?.let { pending ->
            WorkoutCompletionSheet(
                workout = pending,
                onComplete = { run ->
                    if (run != null) viewModel.completeWorkoutWithHealthData(pending, run)
                    else viewModel.completeWorkout(pending)
                    workoutToComplete = null
                    detailWorkout = null
                },
                onDismiss = { workoutToComplete = null },
            )
        }
        return
    }

    workoutToComplete?.let { pending ->
        WorkoutCompletionSheet(
            workout = pending,
            onComplete = { run ->
                if (run != null) viewModel.completeWorkoutWithHealthData(pending, run)
                else viewModel.completeWorkout(pending)
                workoutToComplete = null
            },
            onDismiss = { workoutToComplete = null },
        )
    }

    Box(Modifier.fillMaxSize().background(AthlyColor.backgroundDark).systemBarsPadding()) {
        if (state.isLoading) {
            CircularProgressIndicator(color = AthlyColor.primary, modifier = Modifier.align(Alignment.Center))
        } else {
            Column(Modifier.fillMaxSize()) {
                Text(
                    "Plano",
                    style = AthlyType.heading(24),
                    color = AthlyColor.textPrimary,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )

                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = 12.dp)) {
                    listOf("Lista", "Calendário").forEachIndexed { index, label ->
                        SegmentedButton(
                            selected = viewMode == index,
                            onClick = { viewMode = index },
                            shape = SegmentedButtonDefaults.itemShape(index = index, count = 2),
                            colors = SegmentedButtonDefaults.colors(
                                activeContainerColor = AthlyColor.primary.copy(alpha = 0.2f),
                                activeContentColor = AthlyColor.primary,
                                inactiveContainerColor = AthlyColor.surfaceCard,
                                inactiveContentColor = AthlyColor.textSecondary,
                            ),
                        ) { Text(label) }
                    }
                }

                if (viewMode == 0) {
                    PlanListContent(
                        state = state,
                        viewModel = viewModel,
                        onShowAnalysis = { showAnalysisSheet = true },
                        onCreatePlan = { showCreatePlan = true },
                        onOpenWorkout = { detailWorkout = it },
                        onRequestComplete = { workoutToComplete = it },
                        onShowPaywall = { showPaywall = true },
                    )
                } else {
                    PlanCalendarContent(state = state)
                }
            }
        }

        if (showAnalysisSheet) {
            state.lastAnalysis?.let { analysis ->
                AnalysisSummarySheet(analysis = analysis, onDismiss = { showAnalysisSheet = false })
            }
        }

        state.errorMessage?.let { message ->
            AlertDialog(
                onDismissRequest = { },
                containerColor = AthlyColor.surfaceCard,
                title = { Text("Erro", color = AthlyColor.textPrimary) },
                text = { Text(message, color = AthlyColor.textSecondary) },
                confirmButton = {
                    TextButton(onClick = { viewModel.loadData() }) { Text("OK", color = AthlyColor.primary) }
                },
            )
        }
    }
}

// MARK: - Lista

@Composable
private fun PlanListContent(
    state: PlanUiState,
    viewModel: TrainingPlanViewModel,
    onShowAnalysis: () -> Unit,
    onCreatePlan: () -> Unit,
    onOpenWorkout: (WorkoutDto) -> Unit,
    onRequestComplete: (WorkoutDto) -> Unit,
    onShowPaywall: () -> Unit,
) {
    // Gate premium — espelha o generateButton do iOS (paywall se sem entitlement; fail-open hoje).
    val onGenerate = {
        if (viewModel.canUsePremium) viewModel.generateNextWeek() else onShowPaywall()
    }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp)
            .padding(bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        val plan = state.plan
        if (plan != null) {
            PlanHeaderCard(plan, weeksCount = state.weeks.size)

            state.lastAnalysis?.let { analysis ->
                Box(
                    Modifier.clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onShowAnalysis,
                    ),
                ) {
                    AnalysisSummaryCard(
                        analysis = analysis,
                        previousWeekAnalysis = state.currentWeekGoal?.previousWeekAnalysis,
                        isInteractive = true,
                    )
                }
            }

            GenerateButton(state, onGenerate = onGenerate)

            NextFiveSection(state, viewModel, onOpenWorkout, onRequestComplete)

            if (state.weeks.isEmpty()) {
                EmptyPlanState()
            } else {
                WeekSelector(state, onSelect = viewModel::selectWeek)
                WeekStatsCard(state)
                WorkoutsList(state, viewModel, onOpenWorkout, onRequestComplete)
            }
        } else {
            NoPlanState(state, onCreatePlan = onCreatePlan, onGenerate = onGenerate)
        }
    }
}

@Composable
private fun PlanHeaderCard(plan: TrainingPlanDto, weeksCount: Int) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyInsightCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth()) {
            Text(
                plan.objective,
                style = AthlyType.semibold(17),
                color = AthlyColor.textPrimary,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                null,
                tint = AthlyColor.textTertiary,
                modifier = Modifier.size(16.dp),
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("$weeksCount semanas", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                plan.sports.take(3).forEach { sport ->
                    Icon(sport.icon, null, tint = AthlyColor.primary, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

@Composable
private fun GenerateButton(state: PlanUiState, onGenerate: () -> Unit) {
    val title = when {
        state.isGenerating -> "Iniciando geração..."
        state.isGeneratingInBackground -> "Gerando em segundo plano"
        else -> "Gerar Próxima Semana"
    }
    // Gate premium → paywall vem na fatia 22; por ora gera direto.
    AthlyGradientButton(
        text = title,
        onClick = onGenerate,
        enabled = !state.isGenerating && !state.isGeneratingInBackground,
        modifier = Modifier.fillMaxWidth(),
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NextFiveSection(
    state: PlanUiState,
    viewModel: TrainingPlanViewModel,
    onOpenWorkout: (WorkoutDto) -> Unit,
    onRequestComplete: (WorkoutDto) -> Unit,
) {
    val nextFive = state.nextFiveWorkouts
    val nextId = state.nextWorkout?.id

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Próximos 5 treinos", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)

        if (nextFive.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxWidth().athlyCard().padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Icon(Icons.Filled.EventBusy, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(32.dp))
                Text(
                    "Nenhum treino programado nos próximos dias",
                    style = AthlyType.body(15),
                    color = AthlyColor.textSecondary,
                    textAlign = TextAlign.Center,
                )
            }
        } else {
            nextFive.forEach { workout ->
                WorkoutWithMenu(
                    workout = workout,
                    compact = true,
                    isNext = workout.id == nextId,
                    viewModel = viewModel,
                    onOpen = { onOpenWorkout(workout) },
                    onRequestComplete = { onRequestComplete(workout) },
                )
            }
        }
    }
}

/** Card com tap → detalhe (17) e long-press → menu Concluir/Pular (context menu do iOS). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun WorkoutWithMenu(
    workout: WorkoutDto,
    compact: Boolean,
    isNext: Boolean,
    viewModel: TrainingPlanViewModel,
    onOpen: () -> Unit,
    onRequestComplete: () -> Unit,
) {
    var showMenu by remember { mutableStateOf(false) }
    Box {
        Box(
            Modifier.combinedClickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onOpen,
                onLongClick = { if (workout.status == WorkoutStatus.SCHEDULED) showMenu = true },
            ),
        ) {
            WorkoutCard(workout, compact = compact, isNext = isNext)
        }
        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
            DropdownMenuItem(
                text = { Text("Concluir treino") },
                leadingIcon = { Icon(Icons.Filled.CheckCircle, null) },
                onClick = {
                    showMenu = false
                    onRequestComplete()
                },
            )
            DropdownMenuItem(
                text = { Text("Pular treino") },
                leadingIcon = { Icon(Icons.Filled.History, null) },
                onClick = {
                    showMenu = false
                    viewModel.skipWorkout(workout)
                },
            )
        }
    }
}

@Composable
private fun WeekSelector(state: PlanUiState, onSelect: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        state.weeks.forEachIndexed { index, week ->
            val selected = state.selectedWeekIndex == index
            val base = Modifier
                .clip(CircleShape)
                .then(
                    if (selected) Modifier.background(AthlyGradient.brand)
                    else Modifier
                        .background(AthlyColor.glassBackground)
                        .border(1.dp, AthlyColor.glassBorder, CircleShape),
                )
            Text(
                text = "Sem ${week.number}",
                style = AthlyType.semibold(15),
                color = Color.White,
                modifier = base
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { onSelect(index) }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun WeekStatsCard(state: PlanUiState) {
    Row(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatCell(
            value = "${state.completedThisWeek}/${state.totalThisWeek}",
            label = "Concluídos",
            icon = { Icon(Icons.Filled.CheckCircle, null, tint = AthlyColor.primary, modifier = Modifier.size(22.dp)) },
            modifier = Modifier.weight(1f),
        )
        StatCellDivider()
        StatCell(
            value = "${(state.weeklyProgress * 100).toInt()}%",
            label = "Progresso",
            icon = { Icon(Icons.AutoMirrored.Filled.ShowChart, null, tint = AthlyColor.primary, modifier = Modifier.size(22.dp)) },
            modifier = Modifier.weight(1f),
        )
        state.currentWeekGoal?.metrics?.title?.let { title ->
            StatCellDivider()
            StatCell(
                value = "",
                label = title,
                icon = { Icon(Icons.Filled.GpsFixed, null, tint = AthlyColor.primary, modifier = Modifier.size(22.dp)) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun StatCell(value: String, label: String, icon: @Composable () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        icon()
        if (value.isNotEmpty()) Text(value, style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
        Text(label, style = AthlyType.body(12), color = AthlyColor.textSecondary, textAlign = TextAlign.Center)
    }
}

@Composable
private fun StatCellDivider() {
    Box(Modifier.width(1.dp).height(48.dp).background(AthlyColor.borderDark))
}

@Composable
private fun WorkoutsList(
    state: PlanUiState,
    viewModel: TrainingPlanViewModel,
    onOpenWorkout: (WorkoutDto) -> Unit,
    onRequestComplete: (WorkoutDto) -> Unit,
) {
    val workouts = state.currentWeekWorkouts.filter { it.sportType != SportType.OTHER }
    val nextId = state.nextWorkout?.id
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        workouts.forEach { workout ->
            WorkoutWithMenu(
                workout = workout,
                compact = false,
                isNext = workout.id == nextId,
                viewModel = viewModel,
                onOpen = { onOpenWorkout(workout) },
                onRequestComplete = { onRequestComplete(workout) },
            )
        }
    }
}

@Composable
private fun EmptyPlanState() {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Icon(Icons.AutoMirrored.Filled.ShowChart, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(48.dp))
        Text("Nenhuma semana planejada", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
        Text(
            "Clique em \"Gerar Próxima Semana\" para criar seu primeiro plano de treinos!",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun NoPlanState(state: PlanUiState, onCreatePlan: () -> Unit, onGenerate: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Icon(
            Icons.Filled.AutoAwesome,
            null,
            tint = Color.Unspecified,
            modifier = Modifier
                .size(56.dp)
                .background(
                    Brush.linearGradient(listOf(AthlyColor.primary.copy(alpha = 0.2f), AthlyColor.secondary.copy(alpha = 0.2f))),
                    CircleShape,
                )
                .padding(12.dp),
        )
        Text("Crie seu plano de corrida", style = AthlyType.heading(20), color = AthlyColor.textPrimary)
        Text(
            "Diga qual é seu objetivo e a IA vai criar um plano de treino personalizado para você.",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )
        AthlyGradientButton(text = "Definir meu objetivo", onClick = onCreatePlan, modifier = Modifier.fillMaxWidth())
        Text("ou", style = AthlyType.body(13), color = AthlyColor.textTertiary)
        GenerateButton(state, onGenerate = onGenerate)
    }
}

// MARK: - Calendário

@Composable
private fun PlanCalendarContent(state: PlanUiState) {
    var calendarMonth by rememberSaveable { mutableStateOf(YearMonth.now().toString()) }
    var selectedDateIso by rememberSaveable { mutableStateOf<String?>(null) }
    val month = YearMonth.parse(calendarMonth)
    val selectedDate = selectedDateIso?.let(LocalDate::parse)

    Column(Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { calendarMonth = month.minusMonths(1).toString() }) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Mês anterior", tint = AthlyColor.primary)
            }
            Spacer(Modifier.weight(1f))
            Text(monthYearString(month), style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { calendarMonth = YearMonth.now().toString() }) {
                Text("Hoje", style = AthlyType.body(15), color = AthlyColor.primary)
            }
            IconButton(onClick = { calendarMonth = month.plusMonths(1).toString() }) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Próximo mês", tint = AthlyColor.primary)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp)
                .padding(bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CalendarGrid(
                month = month,
                workouts = state.allWorkouts,
                weeklyGoals = state.weeklyGoals,
                selectedDate = selectedDate,
                onSelectDate = { selectedDateIso = it?.toString() },
            )

            selectedDate?.let { date -> SelectedDayWorkouts(date, state) }
        }
    }
}

@Composable
private fun SelectedDayWorkouts(date: LocalDate, state: PlanUiState) {
    val dayWorkouts = state.allWorkouts
        .filter { it.parsedLocalDate == date && it.sportType != SportType.OTHER }
        .sortedBy { it.parsedDate }
    val nextId = state.nextWorkout?.id

    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = dayTitleFormatter.format(date).replaceFirstChar { it.uppercase() },
            style = AthlyType.semibold(15),
            color = AthlyColor.textPrimary,
        )
        if (dayWorkouts.isEmpty()) {
            Text(
                "Dia de descanso",
                style = AthlyType.body(14),
                color = AthlyColor.textSecondary,
                modifier = Modifier.padding(vertical = 8.dp),
            )
        } else {
            dayWorkouts.forEach { workout ->
                WorkoutCard(workout, compact = true, isNext = workout.id == nextId)
            }
        }
    }
}

private val dayTitleFormatter = DateTimeFormatter.ofPattern("EEEE, d 'de' MMMM", Locale("pt", "BR"))
private val monthYearFormatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale("pt", "BR"))

private fun monthYearString(month: YearMonth): String =
    monthYearFormatter.format(month.atDay(1)).replaceFirstChar { it.uppercase() }
