package com.athly.runner.feature.workout.ui

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.HeartBroken
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.domain.model.HealthRunItem
import com.athly.runner.feature.common.icon
import com.athly.runner.feature.workout.WorkoutCompletionViewModel
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private enum class CompletionStep { HEALTH, FEEDBACK }

/**
 * Sheet de conclusão em 2 passos — espelha `WorkoutCompletionSheet` do iOS:
 * 1) escolher a corrida do Health Connect na janela D..D+2 (ou "Apenas marcar como concluído");
 * 2) feedback (completou? + esforço + fadiga) → `POST /workouts/{id}/feedback` → `onComplete(run?)`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutCompletionSheet(
    workout: WorkoutDto,
    onComplete: (HealthRunItem?) -> Unit,
    onDismiss: () -> Unit,
    viewModel: WorkoutCompletionViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var step by remember { mutableStateOf(CompletionStep.HEALTH) }
    var selectedRun by remember { mutableStateOf<HealthRunItem?>(null) }
    var completed by remember { mutableStateOf(true) }
    var effort by remember { mutableIntStateOf(5) }
    var fatigue by remember { mutableIntStateOf(5) }

    LaunchedEffect(workout.id) { viewModel.loadCandidateRuns(workout) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AthlyColor.backgroundDark) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(
                    onClick = {
                        if (step == CompletionStep.FEEDBACK) step = CompletionStep.HEALTH else onDismiss()
                    },
                ) {
                    Text(
                        if (step == CompletionStep.FEEDBACK) "Voltar" else "Cancelar",
                        style = AthlyType.body(15),
                        color = AthlyColor.textSecondary,
                    )
                }
                Spacer(Modifier.weight(1f))
                Text(
                    if (step == CompletionStep.HEALTH) "Concluir Treino" else "Como foi o treino?",
                    style = AthlyType.semibold(17),
                    color = AthlyColor.textPrimary,
                )
                Spacer(Modifier.weight(1f))
            }

            if (step == CompletionStep.HEALTH) {
                HealthStep(
                    workout = workout,
                    isLoading = state.isLoading,
                    runs = state.runs,
                    loadError = state.loadError,
                    onSelectRun = { run ->
                        selectedRun = run
                        step = CompletionStep.FEEDBACK
                    },
                    onJustComplete = {
                        selectedRun = null
                        step = CompletionStep.FEEDBACK
                    },
                )
            } else {
                FeedbackStep(
                    completed = completed,
                    onCompletedChange = { completed = it },
                    effort = effort,
                    onEffortChange = { effort = it },
                    fatigue = fatigue,
                    onFatigueChange = { fatigue = it },
                    isSubmitting = state.isSubmitting,
                    submitError = state.submitError,
                    onSubmit = {
                        viewModel.submitFeedback(workout.id, completed, effort, fatigue) {
                            onComplete(selectedRun)
                        }
                    },
                    onSkipFeedback = { onComplete(selectedRun) },
                )
            }
        }
    }
}

// MARK: - Passo 1: corridas do Health

@Composable
private fun HealthStep(
    workout: WorkoutDto,
    isLoading: Boolean,
    runs: List<HealthRunItem>,
    loadError: String?,
    onSelectRun: (HealthRunItem) -> Unit,
    onJustComplete: () -> Unit,
) {
    // Resumo do treino
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(workout.sportType.icon, null, tint = AthlyColor.primary, modifier = Modifier.size(16.dp))
            Text(workout.title, style = AthlyType.semibold(16), color = AthlyColor.textPrimary)
        }
        workout.description?.takeIf { it.isNotEmpty() }?.let { desc ->
            Text(
                desc,
                style = AthlyType.body(13),
                color = AthlyColor.textSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }

    when {
        isLoading -> Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            CircularProgressIndicator(color = AthlyColor.primary)
            Text(
                "Buscando corridas no Health Connect…",
                style = AthlyType.body(15),
                color = AthlyColor.textSecondary,
            )
        }

        loadError != null -> Column(
            modifier = Modifier.fillMaxWidth().athlyCard().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Icon(Icons.Filled.Warning, null, tint = AthlyColor.warning, modifier = Modifier.size(32.dp))
            Text("Erro ao acessar o Health Connect", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
            Text(loadError, style = AthlyType.body(13), color = AthlyColor.textSecondary, textAlign = TextAlign.Center)
        }

        runs.isNotEmpty() -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Favorite, null, tint = AthlyColor.primary, modifier = Modifier.size(14.dp))
                Text(
                    "Corridas próximas a ${shortDate(workout)}",
                    style = AthlyType.semibold(15),
                    color = AthlyColor.textPrimary,
                )
            }
            Text(
                "Selecione a corrida que corresponde a este treino (até 2 dias após o planejado):",
                style = AthlyType.body(13),
                color = AthlyColor.textSecondary,
            )
            runs.forEach { run -> HealthRunCandidate(run, workout, onSelect = { onSelectRun(run) }) }
        }

        else -> Column(
            modifier = Modifier.fillMaxWidth().athlyCard().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(Icons.Filled.HeartBroken, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(40.dp))
            Text(
                "Nenhuma corrida encontrada entre ${shortDate(workout)} e os 2 dias seguintes",
                style = AthlyType.semibold(16),
                color = AthlyColor.textPrimary,
                textAlign = TextAlign.Center,
            )
            Text(
                "Se você correu, verifique se o Health Connect está ativado nas configurações do app.",
                style = AthlyType.body(14),
                color = AthlyColor.textSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }

    Box(Modifier.fillMaxWidth().height(1.dp).background(AthlyColor.borderDark))

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AthlyColor.surfaceDark)
            .border(1.dp, AthlyColor.borderDark, RoundedCornerShape(12.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onJustComplete,
            )
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.CheckCircle, null, tint = AthlyColor.textSecondary, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text("Apenas marcar como concluído", style = AthlyType.body(15), color = AthlyColor.textSecondary)
    }
}

@Composable
private fun HealthRunCandidate(run: HealthRunItem, workout: WorkoutDto, onSelect: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(AthlyColor.surfaceCard)
            .border(1.dp, AthlyColor.primary.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onSelect,
            )
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Icon(Icons.AutoMirrored.Filled.DirectionsRun, null, tint = AthlyColor.primary, modifier = Modifier.size(18.dp))
            Text(
                timeFormatter.format(run.startDate.atZone(ZoneId.systemDefault())),
                style = AthlyType.body(11),
                color = AthlyColor.textTertiary,
            )
            relativeDayLabel(run, workout)?.let { label ->
                Text(label, style = AthlyType.body(10), color = AthlyColor.primary)
            }
        }

        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            MetricCell(run.formattedDistance, "km", Modifier.weight(1f))
            Box(Modifier.width(1.dp).height(32.dp).background(AthlyColor.borderDark))
            MetricCell(run.formattedDuration, "tempo", Modifier.weight(1f))
            Box(Modifier.width(1.dp).height(32.dp).background(AthlyColor.borderDark))
            MetricCell("${run.formattedPace}/km", "pace", Modifier.weight(1f))
        }

        Icon(
            Icons.Filled.CheckCircle,
            null,
            tint = AthlyColor.primary.copy(alpha = 0.6f),
            modifier = Modifier.size(22.dp),
        )
    }
}

@Composable
private fun MetricCell(value: String, label: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            value,
            fontFamily = SpaceGrotesk,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            color = AthlyColor.textPrimary,
            maxLines = 1,
        )
        Text(label, style = AthlyType.body(11), color = AthlyColor.textTertiary)
    }
}

// MARK: - Passo 2: feedback

@Composable
private fun FeedbackStep(
    completed: Boolean,
    onCompletedChange: (Boolean) -> Unit,
    effort: Int,
    onEffortChange: (Int) -> Unit,
    fatigue: Int,
    onFatigueChange: (Int) -> Unit,
    isSubmitting: Boolean,
    submitError: String?,
    onSubmit: () -> Unit,
    onSkipFeedback: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(if (completed) "🎉" else "💪", fontSize = 48.sp)
        Text(if (completed) "Parabéns!" else "Bom trabalho!", style = AthlyType.heading(22), color = AthlyColor.textPrimary)
        Text("Conta como foi o seu treino", style = AthlyType.body(14), color = AthlyColor.textSecondary)
    }

    // Conseguiu completar?
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Conseguiu completar?", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            CompletionOption("Sim", "✓", completed, Modifier.weight(1f)) { onCompletedChange(true) }
            CompletionOption("Não", "✗", !completed, Modifier.weight(1f)) { onCompletedChange(false) }
        }
    }

    SliderCard(
        title = "Nível de Esforço",
        value = effort,
        onValueChange = onEffortChange,
        emoji = effortEmoji(effort),
        accent = AthlyColor.primary,
        labels = Triple("Fácil", "Moderado", "Intenso"),
    )

    SliderCard(
        title = "Nível de Fadiga",
        value = fatigue,
        onValueChange = onFatigueChange,
        emoji = fatigueEmoji(fatigue),
        accent = AthlyColor.secondary,
        labels = Triple("Energizado", "Normal", "Exausto"),
    )

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        AthlyGradientButton(
            text = if (isSubmitting) "Enviando…" else "Enviar feedback",
            onClick = onSubmit,
            enabled = !isSubmitting,
            modifier = Modifier.fillMaxWidth(),
        )
        submitError?.let { error ->
            Text(error, style = AthlyType.body(13), color = AthlyColor.error, textAlign = TextAlign.Center)
        }
        TextButton(onClick = onSkipFeedback) {
            Text("Pular por agora", style = AthlyType.body(15), color = AthlyColor.textSecondary)
        }
    }
}

@Composable
private fun CompletionOption(
    label: String,
    emoji: String,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val base = Modifier
        .clip(RoundedCornerShape(16.dp))
        .then(
            if (selected) Modifier.background(AthlyGradient.brand)
            else Modifier
                .background(AthlyColor.surfaceDark)
                .border(1.dp, AthlyColor.borderDark, RoundedCornerShape(16.dp)),
        )
    Column(
        modifier = modifier
            .then(base)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(emoji, fontSize = 28.sp, color = if (selected) Color.White else AthlyColor.textSecondary)
        Text(
            label,
            style = AthlyType.semibold(15),
            color = if (selected) Color.White else AthlyColor.textSecondary,
        )
    }
}

@Composable
private fun SliderCard(
    title: String,
    value: Int,
    onValueChange: (Int) -> Unit,
    emoji: String,
    accent: Color,
    labels: Triple<String, String, String>,
) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(emoji, fontSize = 36.sp)
            Spacer(Modifier.weight(1f))
            Text(
                "$value/10",
                fontFamily = SpaceGrotesk,
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                color = accent,
            )
        }
        Slider(
            value = value.toFloat(),
            onValueChange = { onValueChange(it.toInt().coerceIn(1, 10)) },
            valueRange = 1f..10f,
            steps = 8,
            colors = SliderDefaults.colors(
                thumbColor = accent,
                activeTrackColor = accent,
                inactiveTrackColor = AthlyColor.borderDark,
            ),
        )
        Row(Modifier.fillMaxWidth()) {
            Text(labels.first, style = AthlyType.body(11), color = AthlyColor.textTertiary)
            Spacer(Modifier.weight(1f))
            Text(labels.second, style = AthlyType.body(11), color = AthlyColor.textTertiary)
            Spacer(Modifier.weight(1f))
            Text(labels.third, style = AthlyType.body(11), color = AthlyColor.textTertiary)
        }
    }
}

// MARK: - Helpers (espelham o iOS)

private fun effortEmoji(effort: Int): String = when {
    effort <= 3 -> "😌"
    effort <= 6 -> "💪"
    effort <= 8 -> "🔥"
    else -> "😤"
}

private fun fatigueEmoji(fatigue: Int): String = when {
    fatigue <= 3 -> "⚡"
    fatigue <= 6 -> "😅"
    fatigue <= 8 -> "😰"
    else -> "😵"
}

private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")
private val shortDateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale("pt", "BR"))

private fun shortDate(workout: WorkoutDto): String =
    shortDateFormatter.format(workout.parsedDate.atZone(ZoneId.systemDefault()))

/** "+1 dia"/"+2 dias" quando a corrida não é do mesmo dia do treino; nil no próprio dia. */
private fun relativeDayLabel(run: HealthRunItem, workout: WorkoutDto): String? {
    val zone = ZoneId.systemDefault()
    val workoutDay = workout.parsedDate.atZone(zone).toLocalDate()
    val runDay = run.startDate.atZone(zone).toLocalDate()
    return when (ChronoUnit.DAYS.between(workoutDay, runDay).toInt()) {
        1 -> "+1 dia"
        2 -> "+2 dias"
        else -> null
    }
}
