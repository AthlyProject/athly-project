package com.athly.runner.feature.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.remote.dto.WorkoutDto
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Card de treino — espelha `WorkoutCardView` do iOS: badge 🎯 (isGoalAttempt), header esporte+título ↔
 * status+"Próximo treino", descrição (só não-compact), rodapé data · intensidade colorida · "IA".
 */
@Composable
fun WorkoutCard(
    workout: WorkoutDto,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    isNext: Boolean = false,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .athlyCard(glow = isNext)
            .padding(if (compact) 12.dp else 16.dp),
        verticalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 12.dp),
    ) {
        if (workout.isGoalAttempt == true) GoalAttemptBadge()

        Row(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                SportBadge(workout.sportType)
                Text(
                    text = workout.title,
                    style = if (compact) AthlyType.body(15) else AthlyType.semibold(17),
                    color = AthlyColor.textPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                StatusBadge(workout.status)
                if (isNext) {
                    Text("PRÓXIMO TREINO", style = AthlyType.label, color = AthlyColor.primaryNeon)
                }
            }
        }

        if (!compact && !workout.description.isNullOrEmpty()) {
            Text(
                text = workout.description!!,
                style = AthlyType.body(15),
                color = AthlyColor.textSecondary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            FooterLabel(
                icon = { Icon(Icons.Filled.CalendarMonth, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(12.dp)) },
                text = cardDate(workout),
                color = AthlyColor.textTertiary,
            )
            workout.intensity?.let { intensity ->
                val color = intensityColor(intensity)
                FooterLabel(
                    icon = { Icon(Icons.Filled.Bolt, null, tint = color, modifier = Modifier.size(12.dp)) },
                    text = "Intensidade ${intensity.toInt()}",
                    color = color,
                )
            }
            Spacer(Modifier.weight(1f))
            if (workout.trainingPlanId != null) {
                FooterLabel(
                    icon = { Icon(Icons.Filled.AutoAwesome, null, tint = AthlyColor.secondary, modifier = Modifier.size(12.dp)) },
                    text = "IA",
                    color = AthlyColor.secondary,
                )
            }
        }
    }
}

@Composable
private fun FooterLabel(icon: @Composable () -> Unit, text: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        icon()
        Text(text, style = AthlyType.body(12), color = color)
    }
}

@Composable
private fun GoalAttemptBadge() {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(AthlyColor.primary.copy(alpha = 0.18f))
            .border(1.dp, AthlyColor.primary, CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("🎯", style = AthlyType.body(12))
        Text("TREINO-ALVO", style = AthlyType.label, color = AthlyColor.textPrimary)
    }
}

private fun intensityColor(value: Double): Color = when (value.toInt()) {
    in 1..3 -> AthlyColor.success
    in 4..6 -> AthlyColor.warning
    else -> AthlyColor.error
}

private val cardDateFormatter = DateTimeFormatter.ofPattern("d 'de' MMM 'de' yyyy", Locale("pt", "BR"))

private fun cardDate(workout: WorkoutDto): String =
    cardDateFormatter.format(workout.parsedDate.atZone(ZoneId.systemDefault()))
