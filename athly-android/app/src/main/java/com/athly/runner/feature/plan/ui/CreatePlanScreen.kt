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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.remote.dto.ParsedGoalDto
import com.athly.runner.feature.plan.CreatePlanUiState
import com.athly.runner.feature.plan.CreatePlanViewModel
import com.athly.runner.feature.plan.PlanUiState
import com.athly.runner.feature.plan.TrainingPlanViewModel

private val suggestions = listOf(
    "Quero correr 5km sem parar",
    "Quero completar uma meia maratona em 6 meses",
    "Quero melhorar meu tempo no 10km para menos de 50 min",
    "Quero começar a correr e ter mais disposição",
    "Quero preparar para minha primeira maratona",
)

/**
 * Tela "Novo Plano" — espelha `CreatePlanView` do iOS: input do objetivo (limite 500, pills de
 * exemplo, erro 422 pt-BR) → confirmação com o `parsedGoal` → "Gerar primeira semana de treinos"
 * (delegado ao [TrainingPlanViewModel], que roda o plan-from-health assíncrono + polling).
 */
@Composable
fun CreatePlanScreen(
    planViewModel: TrainingPlanViewModel,
    onDismiss: () -> Unit,
    viewModel: CreatePlanViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val planState by planViewModel.state.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AthlyColor.backgroundDark)
            .systemBarsPadding(),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Novo Plano", style = AthlyType.heading(24), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onDismiss) {
                Text("Cancelar", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            }
        }

        val goal = state.parsedGoal
        if (state.showConfirmation && goal != null) {
            ConfirmationContent(
                goal = goal,
                planState = planState,
                onGenerate = {
                    planViewModel.generateNextWeek()
                    onDismiss()
                },
                onLater = onDismiss,
            )
        } else {
            InputContent(state = state, viewModel = viewModel)
        }
    }
}

@Composable
private fun InputContent(state: CreatePlanUiState, viewModel: CreatePlanViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp)
            .padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Qual é o seu objetivo?", style = AthlyType.heading(22), color = AthlyColor.textPrimary)
            Text(
                "Descreva em suas palavras o que você quer conquistar correndo.",
                style = AthlyType.body(15),
                color = AthlyColor.textSecondary,
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BasicTextField(
                value = state.goalText,
                onValueChange = viewModel::onGoalTextChange,
                textStyle = AthlyType.body(15).copy(color = AthlyColor.textPrimary),
                cursorBrush = SolidColor(AthlyColor.primary),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp, max = 180.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(AthlyColor.surfaceCard)
                    .border(
                        width = 1.dp,
                        color = if (state.goalText.isEmpty()) {
                            AthlyColor.textTertiary.copy(alpha = 0.3f)
                        } else {
                            AthlyColor.primary.copy(alpha = 0.5f)
                        },
                        shape = RoundedCornerShape(16.dp),
                    )
                    .padding(12.dp),
            )
            Text(
                text = "${state.goalText.length}/${CreatePlanViewModel.MAX_LENGTH}",
                style = AthlyType.body(12),
                color = AthlyColor.textTertiary,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("EXEMPLOS", style = AthlyType.label, color = AthlyColor.textTertiary)
            suggestions.forEach { suggestion ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(AthlyColor.surfaceCard)
                        .clickable(
                            interactionSource = androidx.compose.runtime.remember { MutableInteractionSource() },
                            indication = null,
                        ) { viewModel.onGoalTextChange(suggestion) }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Filled.Lightbulb,
                        null,
                        tint = AthlyColor.primary.copy(alpha = 0.7f),
                        modifier = Modifier.size(12.dp),
                    )
                    Text(suggestion, style = AthlyType.body(14), color = AthlyColor.textSecondary)
                }
            }
        }

        state.errorMessage?.let { error ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(AthlyColor.error.copy(alpha = 0.1f))
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(Icons.Filled.Error, null, tint = AthlyColor.error, modifier = Modifier.size(16.dp))
                Text(error, style = AthlyType.body(14), color = AthlyColor.error)
            }
        }

        AthlyGradientButton(
            text = if (state.isSubmitting) "Interpretando objetivo..." else "Criar meu plano",
            onClick = viewModel::submitGoal,
            enabled = state.goalText.length >= CreatePlanViewModel.MIN_LENGTH && !state.isSubmitting,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
        )
    }
}

@Composable
private fun ConfirmationContent(
    goal: ParsedGoalDto,
    planState: PlanUiState,
    onGenerate: () -> Unit,
    onLater: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp).padding(bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.weight(1f))

        Column(
            modifier = Modifier.fillMaxWidth().athlyCard().padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(Icons.Filled.CheckCircle, null, tint = AthlyColor.success, modifier = Modifier.size(56.dp))
            Text("Objetivo entendido!", style = AthlyType.heading(22), color = AthlyColor.textPrimary)
            Text(
                goal.summary,
                style = AthlyType.semibold(17),
                color = AthlyColor.primary,
                textAlign = TextAlign.Center,
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(AthlyColor.surfaceCard)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                goal.targetDistance?.let { DetailRow(Icons.Filled.Flag, "Distância alvo: $it") }
                goal.targetTime?.let { DetailRow(Icons.Filled.Schedule, "Tempo alvo: $it") }
                goal.eventName?.let { DetailRow(Icons.Filled.CalendarMonth, "Evento: $it") }
                goal.experienceLevel?.let { level ->
                    val label = when (level) {
                        "beginner" -> "Iniciante"
                        "intermediate" -> "Intermediário"
                        "advanced" -> "Avançado"
                        else -> level
                    }
                    DetailRow(Icons.Filled.BarChart, "Nível: $label")
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Column(verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val title = when {
                planState.isGenerating -> "Iniciando geração..."
                planState.isGeneratingInBackground -> "Gerando em segundo plano"
                else -> "Gerar primeira semana de treinos"
            }
            AthlyGradientButton(
                text = title,
                onClick = onGenerate,
                enabled = !planState.isGenerating && !planState.isGeneratingInBackground,
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = onLater) {
                Text("Fazer isso depois", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            }
        }
    }
}

@Composable
private fun DetailRow(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = AthlyColor.primary, modifier = Modifier.size(14.dp))
        }
        Text(text, style = AthlyType.body(14), color = AthlyColor.textSecondary)
        Spacer(Modifier.weight(1f))
    }
}
