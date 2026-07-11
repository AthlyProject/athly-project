package com.athly.runner.feature.dashboard.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.component.athlyInsightCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.mapper.isToday
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import com.athly.runner.domain.model.RunSession
import com.athly.runner.feature.common.StatusBadge
import com.athly.runner.feature.common.icon
import com.athly.runner.feature.common.label
import com.athly.runner.feature.dashboard.DashboardViewModel
import com.athly.runner.feature.plan.TrainingPlanViewModel
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Dashboard (home) — espelha `DashboardView` do iOS: saudação por hora, dia de descanso, progresso
 * semanal (semana de calendário) com treino destacado + "Iniciar treino agora", barras dos últimos
 * 7 dias (RunStore) e sequência. (Conquistas/AchievementStore não portadas — só a sequência.)
 */
@Composable
fun DashboardScreen(
    onNavigateToRun: () -> Unit,
    planViewModel: TrainingPlanViewModel = hiltViewModel(),
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val planState by planViewModel.state.collectAsStateWithLifecycle()
    val userName by viewModel.userName.collectAsStateWithLifecycle()
    val recentRuns by viewModel.recentRuns.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { planViewModel.loadData() }

    Box(Modifier.fillMaxSize().dashboardGlow().systemBarsPadding()) {
        if (planState.isLoading) {
            CircularProgressIndicator(color = AthlyColor.primary, modifier = Modifier.align(Alignment.Center))
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp)
                    .padding(bottom = 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Athly",
                    style = AthlyType.heading(24),
                    color = AthlyColor.textPrimary,
                    modifier = Modifier.padding(vertical = 8.dp),
                )

                GreetingCard(userName)

                if (planState.todayWorkout == null) RestDayCard()

                WeeklyProgressCard(
                    planState = planState,
                    onStartWorkout = { workout ->
                        viewModel.startWorkout(workout)
                        onNavigateToRun()
                    },
                )

                ActivityBarsCard(recentRuns)

                StreakCard(streak = planState.currentStreak, hasPlan = planState.allWorkouts.isNotEmpty())
            }
        }
    }
}

@Composable
private fun GreetingCard(userName: String) {
    Row(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = "Olá, ${userName.ifEmpty { "Atleta" }}!",
                style = AthlyType.heading(24).copy(
                    brush = Brush.linearGradient(listOf(AthlyColor.primary, AthlyColor.secondary)),
                ),
            )
            Text(greetingSubtitle(), style = AthlyType.body(15), color = AthlyColor.textSecondary)
        }
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(AthlyColor.primary.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.AutoMirrored.Filled.DirectionsRun,
                null,
                tint = AthlyColor.primary,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

/** Limiares idênticos ao iOS: 6–12 / 12–18 / senão. */
private fun greetingSubtitle(): String = when (LocalTime.now().hour) {
    in 6..11 -> "Bom dia! Pronto para treinar?"
    in 12..17 -> "Boa tarde! Hora do treino?"
    else -> "Boa noite! Recuperando bem?"
}

@Composable
private fun RestDayCard() {
    Row(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.Filled.Bedtime, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(34.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Dia de descanso", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
            Text(
                "Aproveite para recuperar. Amanhã tem mais!",
                style = AthlyType.body(15),
                color = AthlyColor.textSecondary,
            )
        }
    }
}

@Composable
private fun WeeklyProgressCard(
    planState: com.athly.runner.feature.plan.PlanUiState,
    onStartWorkout: (WorkoutDto) -> Unit,
) {
    val highlighted = planState.todayWorkout ?: planState.thisWeekNext

    Column(
        modifier = Modifier.fillMaxWidth().athlyInsightCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
                Text("PROGRESSO SEMANAL", style = AthlyType.label, color = AthlyColor.primary)
                if (planState.thisWeekTotal == 0) {
                    Text("Nenhum treino planejado", style = AthlyType.heading(22), color = AthlyColor.textSecondary)
                } else {
                    Text(
                        "${planState.thisWeekCompleted} / ${planState.thisWeekTotal} treinos",
                        style = AthlyType.heading(22),
                        color = AthlyColor.textPrimary,
                    )
                }
            }
            Row(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(AthlyColor.secondary.copy(alpha = 0.15f))
                    .border(1.dp, AthlyColor.secondary.copy(alpha = 0.4f), CircleShape)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.TrendingUp,
                    null,
                    tint = AthlyColor.secondary,
                    modifier = Modifier.size(10.dp),
                )
                Text(
                    "${(planState.thisWeekProgress * 100).toInt()}%",
                    style = AthlyType.semibold(13),
                    color = AthlyColor.secondary,
                )
            }
        }

        // Barra de progresso (track escuro + fill gradiente brand)
        Box(Modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(AthlyColor.surfaceDark)) {
            Box(
                Modifier
                    .fillMaxWidth(planState.thisWeekProgress.toFloat().coerceIn(0.02f, 1f))
                    .height(8.dp)
                    .clip(CircleShape)
                    .background(AthlyGradient.brand),
            )
        }

        highlighted?.let { workout ->
            Box(Modifier.fillMaxWidth().height(1.dp).background(AthlyColor.glassBorder))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    if (workout.isToday) "TREINO DE HOJE" else "PRÓXIMO TREINO",
                    style = AthlyType.label,
                    color = AthlyColor.textTertiary,
                )
                HighlightedWorkoutRow(workout)
                if (workout.isToday && workout.status == WorkoutStatus.SCHEDULED) {
                    AthlyGradientButton(
                        text = "Iniciar treino agora",
                        onClick = { onStartWorkout(workout) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun HighlightedWorkoutRow(workout: WorkoutDto) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(AthlyColor.surfaceDark.copy(alpha = 0.78f))
            .border(1.dp, AthlyColor.glassBorder, RoundedCornerShape(10.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(AthlyColor.primary.copy(alpha = 0.14f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(workout.sportType.icon, null, tint = AthlyColor.primary, modifier = Modifier.size(18.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                Text(workout.sportType.label.uppercase(), style = AthlyType.label, color = AthlyColor.primary)
                Text(
                    workout.title,
                    style = AthlyType.semibold(16),
                    color = AthlyColor.textPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            StatusBadge(workout.status)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Icons.Filled.CalendarMonth, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(12.dp))
                Text(
                    shortDateFormatter.format(workout.parsedDate.atZone(ZoneId.systemDefault())),
                    style = AthlyType.body(12),
                    color = AthlyColor.textTertiary,
                )
            }
            workout.intensity?.let { intensity ->
                val color = when (intensity.toInt()) {
                    in 1..3 -> AthlyColor.success
                    in 4..6 -> AthlyColor.warning
                    else -> AthlyColor.error
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Filled.Bolt, null, tint = color, modifier = Modifier.size(12.dp))
                    Text("Intensidade ${intensity.toInt()}", style = AthlyType.body(12), color = color)
                }
            }
        }
    }
}

@Composable
private fun ActivityBarsCard(recentRuns: List<RunSession>) {
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val days = (6 downTo 0).map { today.minusDays(it.toLong()) }

    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Últimos 7 dias", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            val totalKm = recentRuns.take(7).sumOf { it.distanceMeters / 1000.0 }
            if (totalKm > 0) {
                Text(
                    String.format(Locale.US, "%.1f km", totalKm),
                    style = AthlyType.body(13),
                    color = AthlyColor.secondary,
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 60.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            days.forEach { day ->
                val km = recentRuns
                    .filter { it.startDate.atZone(zone).toLocalDate() == day }
                    .sumOf { it.distanceMeters / 1000.0 }
                val isToday = day == today

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (km > 0) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height((km * 10).dp.coerceIn(10.dp, 60.dp))
                                .clip(RoundedCornerShape(5.dp))
                                .background(AthlyGradient.brand),
                        )
                    } else {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(10.dp)
                                .clip(RoundedCornerShape(5.dp))
                                .background(AthlyColor.surfaceDark)
                                .border(1.dp, AthlyColor.glassBorder, RoundedCornerShape(5.dp)),
                        )
                    }
                    Text(
                        text = narrowWeekday(day),
                        style = AthlyType.body(11).copy(
                            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                        ),
                        color = if (isToday) AthlyColor.primary else AthlyColor.textTertiary,
                    )
                }
            }
        }
    }
}

@Composable
private fun StreakCard(streak: Int, hasPlan: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("🔥", style = AthlyType.heading(28))
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = if (hasPlan) "$streak" else "-",
                style = AthlyType.heading(22),
                color = AthlyColor.textPrimary,
            )
            Text("Sequência de treinos", style = AthlyType.body(12), color = AthlyColor.textSecondary)
        }
    }
}

private val shortDateFormatter = DateTimeFormatter.ofPattern("d 'de' MMM", Locale("pt", "BR"))
private val weekdayFormatter = DateTimeFormatter.ofPattern("EEEEE", Locale("pt", "BR"))

private fun narrowWeekday(day: LocalDate): String = weekdayFormatter.format(day).uppercase()

/** Glows radiais ambiente — primary @14% topo-esquerda, secondary @8% baixo-direita (iOS). */
private fun Modifier.dashboardGlow(): Modifier = this
    .background(AthlyColor.backgroundDark)
    .drawWithCache {
        val g1 = Brush.radialGradient(
            colors = listOf(AthlyColor.primary.copy(alpha = 0.14f), Color.Transparent),
            center = Offset(size.width * 0.05f, 0f),
            radius = size.minDimension * 0.6f,
        )
        val g2 = Brush.radialGradient(
            colors = listOf(AthlyColor.secondary.copy(alpha = 0.08f), Color.Transparent),
            center = Offset(size.width, size.height),
            radius = size.minDimension * 0.5f,
        )
        onDrawBehind {
            drawRect(g1)
            drawRect(g2)
        }
    }
