package com.athly.runner.feature.plan.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import com.athly.runner.data.mapper.parsedEndDate
import com.athly.runner.data.mapper.parsedLocalDate
import com.athly.runner.data.mapper.parsedStartDate
import com.athly.runner.data.remote.dto.SportType
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

/**
 * Grid mensal — espelha `CalendarGridView` do iOS: cabeçalho Dom..Sáb, SEMPRE 42 células (6 linhas,
 * meses vizinhos preenchem as bordas), banner de meta por linha (casa por intervalo de datas) e
 * dots de status por dia. Seleção é toggle e só em dia com treino.
 */
@Composable
fun CalendarGrid(
    month: YearMonth,
    workouts: List<WorkoutDto>,
    weeklyGoals: List<WeeklyGoalDto>,
    selectedDate: LocalDate?,
    onSelectDate: (LocalDate?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val days = remember(month) { gridDays(month) }
    val workoutsByDay = remember(workouts) {
        workouts
            .filter { it.sportType != SportType.OTHER }
            .groupBy { it.parsedLocalDate }
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth()) {
            listOf("DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB").forEach { label ->
                Text(
                    text = label,
                    style = AthlyType.label,
                    color = AthlyColor.textTertiary,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }

        days.chunked(7).forEach { week ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                goalForWeek(week.first().date, weeklyGoals)?.let { WeekGoalBanner(it) }
                Row(Modifier.fillMaxWidth()) {
                    week.forEach { item ->
                        CalendarDayCell(
                            day = item.day,
                            isToday = item.isToday,
                            isInMonth = item.isInMonth,
                            workouts = workoutsByDay[item.date].orEmpty(),
                            isSelected = selectedDate == item.date,
                            onTap = { onSelectDate(if (selectedDate == item.date) null else item.date) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

/** Banner de meta da linha — `weekGoalBanner`: sparkles + título/trend + "↩ N%" colorido. */
@Composable
private fun WeekGoalBanner(goal: WeeklyGoalDto) {
    val insight = goal.metrics?.title?.takeIf { it.isNotEmpty() }
        ?: goal.metrics?.trend?.takeIf { it.isNotEmpty() }
        ?: "Meta da semana"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(AthlyColor.primary.copy(alpha = 0.08f))
            .border(1.dp, AthlyColor.primary.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(Icons.Filled.AutoAwesome, null, tint = AthlyColor.primary, modifier = Modifier.size(10.dp))
        Text(
            text = insight,
            style = AthlyType.body(11),
            color = AthlyColor.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Spacer(Modifier.weight(1f))
        goal.previousWeekAnalysis?.completionRate?.let { rate ->
            val color = when {
                rate >= 0.8 -> AthlyColor.success
                rate >= 0.5 -> AthlyColor.warning
                else -> AthlyColor.error
            }
            Text("↩ ${(rate * 100).toInt()}%", style = AthlyType.semibold(10), color = color)
        }
    }
}

/** Célula do dia — espelha `CalendarDayCellView`: hoje = anel neon + bold; até 3 dots por status. */
@Composable
fun CalendarDayCell(
    day: Int,
    isToday: Boolean,
    isInMonth: Boolean,
    workouts: List<WorkoutDto>,
    isSelected: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null,
            enabled = workouts.isNotEmpty(),
            onClick = onTap,
        ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(30.dp)) {
            if (isSelected) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(AthlyColor.primary.copy(alpha = 0.25f)))
            }
            if (isToday) {
                Box(Modifier.size(30.dp).border(2.dp, AthlyColor.primaryNeon, CircleShape))
            }
            Text(
                text = "$day",
                fontFamily = SpaceGrotesk,
                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp,
                color = when {
                    isSelected -> AthlyColor.primary
                    isToday -> AthlyColor.primaryNeon
                    isInMonth -> AthlyColor.textPrimary
                    else -> AthlyColor.textTertiary
                },
            )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.size(width = 19.dp, height = 5.dp)) {
            workouts.take(3).forEach { workout ->
                Box(Modifier.size(5.dp).clip(CircleShape).background(dotColor(workout.status)))
            }
        }
    }
}

private fun dotColor(status: WorkoutStatus) = when (status) {
    WorkoutStatus.DONE -> AthlyColor.success
    WorkoutStatus.SKIPPED -> AthlyColor.error
    WorkoutStatus.PARTIAL -> AthlyColor.warning
    WorkoutStatus.SCHEDULED -> AthlyColor.primary
}

private data class DayItem(
    val day: Int,
    val date: LocalDate,
    val isToday: Boolean,
    val isInMonth: Boolean,
)

/** Sempre 42 células — mesmo cálculo do iOS (1º weekday com domingo=0; vizinhos nas bordas). */
private fun gridDays(month: YearMonth): List<DayItem> {
    val today = LocalDate.now(ZoneId.systemDefault())
    val firstOfMonth = month.atDay(1)
    val firstWeekday = firstOfMonth.dayOfWeek.value % 7 // domingo=0 ... sábado=6

    val items = mutableListOf<DayItem>()

    if (firstWeekday > 0) {
        val prevMonth = month.minusMonths(1)
        val daysInPrev = prevMonth.lengthOfMonth()
        for (i in (firstWeekday - 1) downTo 0) {
            val day = daysInPrev - i
            items.add(DayItem(day, prevMonth.atDay(day), isToday = false, isInMonth = false))
        }
    }

    for (day in 1..month.lengthOfMonth()) {
        val date = month.atDay(day)
        items.add(DayItem(day, date, isToday = date == today, isInMonth = true))
    }

    val remaining = 42 - items.size
    if (remaining > 0) {
        val nextMonth = month.plusMonths(1)
        for (day in 1..remaining) {
            items.add(DayItem(day, nextMonth.atDay(day), isToday = false, isInMonth = false))
        }
    }

    return items
}

/** Meta cujo intervalo [start, end] contém a data — `goalForWeek` casa por datas, não por índice. */
private fun goalForWeek(date: LocalDate, goals: List<WeeklyGoalDto>): WeeklyGoalDto? {
    val zone = ZoneId.systemDefault()
    return goals.firstOrNull { goal ->
        val start = goal.parsedStartDate.atZone(zone).toLocalDate()
        val end = goal.parsedEndDate.atZone(zone).toLocalDate()
        date in start..end
    }
}
