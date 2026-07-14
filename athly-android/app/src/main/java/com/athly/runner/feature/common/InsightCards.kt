package com.athly.runner.feature.common

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.component.athlyInsightCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.data.remote.dto.PreviousWeekAnalysisDto
import com.athly.runner.data.remote.dto.RunAnalysisDto
import com.athly.runner.data.remote.dto.WeeklyGoalDto
import java.util.Locale
import kotlin.math.roundToInt

/*
 * Cards de insight da IA — espelham `WeeklyGoalInsightCard.swift` e `AnalysisSummaryCard.swift`
 * (o feedback da semana anterior vive DENTRO do AnalysisSummaryCard, como no iOS real).
 */

/** Insight/meta da semana atual — só renderiza com `metrics.fitnessInsights` não-vazio. */
@Composable
fun WeeklyGoalInsightCard(goal: WeeklyGoalDto, modifier: Modifier = Modifier) {
    val metrics = goal.metrics ?: return
    val insights = metrics.fitnessInsights?.takeIf { it.isNotEmpty() } ?: return

    Column(
        modifier = modifier.fillMaxWidth().athlyInsightCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Filled.GpsFixed, null, tint = AthlyColor.primary, modifier = Modifier.size(13.dp))
            Text("Meta da Semana", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            metrics.trend?.takeIf { it.isNotEmpty() }?.let { TrendBadge(it) }
        }

        Text(
            text = insights,
            style = AthlyType.body(14),
            color = AthlyColor.textSecondary,
            maxLines = 4,
            overflow = TextOverflow.Ellipsis,
        )

        val pace = metrics.avgPace
        val dist = metrics.totalDistanceKm
        if (pace != null && dist != null) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                MetricChip("Vol. alvo", String.format(Locale.US, "%.1f km", dist), Modifier.weight(1f))
                ChipDivider(28.dp)
                MetricChip("Pace ref.", pace, Modifier.weight(1f))
                metrics.runsAnalyzed?.let { runs ->
                    ChipDivider(28.dp)
                    MetricChip("Corridas anal.", "$runs", Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun TrendBadge(trend: String) {
    val (label, color) = when {
        trend.lowercase().contains("improving") -> "Em alta" to AthlyColor.success
        trend.lowercase() == "maintaining" -> "Estável" to AthlyColor.primary
        trend.lowercase() == "declining" -> "Em baixa" to AthlyColor.warning
        else -> trend to AthlyColor.textSecondary
    }
    Text(
        text = label,
        style = AthlyType.semibold(11),
        color = color,
        modifier = Modifier
            .clip(CircleShape)
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/** "improving (volume)" → "Em alta (volume)" etc. — espelha `trendLabel` do iOS. */
fun trendLabel(trend: String): String = when (trend.lowercase()) {
    "improving (volume)" -> "Em alta (volume)"
    "improving (intensity)" -> "Em alta (intensidade)"
    "maintaining" -> "Estável"
    "declining" -> "Em baixa"
    else -> trend
}

/** Análise dos treinos + (opcional) semana anterior + tendência — espelha `AnalysisSummaryCard`. */
@Composable
fun AnalysisSummaryCard(
    analysis: RunAnalysisDto,
    modifier: Modifier = Modifier,
    previousWeekAnalysis: PreviousWeekAnalysisDto? = null,
    isInteractive: Boolean = false,
) {
    Column(
        modifier = modifier.fillMaxWidth().athlyInsightCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Icons.Filled.AutoAwesome, null, tint = AthlyColor.primary, modifier = Modifier.size(13.dp))
            Text("Análise dos seus treinos", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
        }

        Text(
            text = analysis.fitnessInsights,
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            maxLines = 4,
            overflow = TextOverflow.Ellipsis,
        )

        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            MetricChip("Período", analysis.period, Modifier.weight(1f))
            ChipDivider(32.dp)
            MetricChip("Corridas", "${analysis.runsAnalyzed}", Modifier.weight(1f))
            ChipDivider(32.dp)
            MetricChip("Média", String.format(Locale.US, "%.1f km", analysis.avgDistanceKm), Modifier.weight(1f))
            ChipDivider(32.dp)
            MetricChip("Pace", analysis.avgPace, Modifier.weight(1f))
        }

        previousWeekAnalysis?.let { previous ->
            Box(Modifier.fillMaxWidth().height(1.dp).background(AthlyColor.glassBorder))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("SEMANA ANTERIOR", style = AthlyType.label, color = AthlyColor.textTertiary)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    MetricChip("Treinos", previousWeekWorkouts(previous), Modifier.weight(1f))
                    ChipDivider(32.dp)
                    MetricChip("Distância", previousWeekDistance(previous), Modifier.weight(1f))
                    ChipDivider(32.dp)
                    MetricChip("Volume", previousWeekVolume(previous), Modifier.weight(1f))
                }
            }
        }

        if (analysis.trend.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Tendência:", style = AthlyType.body(12), color = AthlyColor.textTertiary)
                Text(trendLabel(analysis.trend), style = AthlyType.semibold(12), color = AthlyColor.primary)
            }
        }

        if (isInteractive) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("Toque para ver o resumo completo", style = AthlyType.body(12), color = AthlyColor.textTertiary)
                Spacer(Modifier.weight(1f))
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    null,
                    tint = AthlyColor.primary,
                    modifier = Modifier.size(14.dp),
                )
            }
        }
    }
}

private fun previousWeekWorkouts(analysis: PreviousWeekAnalysisDto): String {
    val completed = analysis.completedWorkouts ?: return "-"
    val total = analysis.totalWorkouts ?: return "-"
    return "$completed/$total"
}

private fun previousWeekDistance(analysis: PreviousWeekAnalysisDto): String =
    analysis.totalDistanceKm?.let { String.format(Locale.US, "%.1f km", it) } ?: "-"

private fun previousWeekVolume(analysis: PreviousWeekAnalysisDto): String =
    when (analysis.volumeChange?.takeIf { it.isNotEmpty() }?.lowercase()) {
        null -> "-"
        "increase" -> "Mais"
        "decrease" -> "Menos"
        "maintain" -> "Igual"
        else -> analysis.volumeChange!!
    }

/** Sheet do resumo completo — espelha `AnalysisSummarySheet` ("Leitura da Athly"). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalysisSummarySheet(analysis: RunAnalysisDto, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = AthlyColor.backgroundDark) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Resumo da IA", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onDismiss) { Text("Fechar", color = AthlyColor.primary) }
            }

            Column(
                modifier = Modifier.fillMaxWidth().athlyInsightCard().padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                        Text("Leitura da Athly", style = AthlyType.semibold(18), color = AthlyColor.textPrimary)
                        Text(
                            "Resumo detalhado da análise feita a partir dos seus treinos recentes.",
                            style = AthlyType.body(13),
                            color = AthlyColor.textSecondary,
                        )
                    }
                    if (analysis.trend.isNotEmpty()) {
                        Text(
                            text = trendLabel(analysis.trend),
                            style = AthlyType.semibold(12),
                            color = AthlyColor.primary,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(AthlyColor.primary.copy(alpha = 0.14f))
                                .padding(horizontal = 10.dp, vertical = 5.dp),
                        )
                    }
                }
                Text(analysis.fitnessInsights, style = AthlyType.body(15), color = AthlyColor.textSecondary)
            }

            Column(
                modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ListAlt, null, tint = AthlyColor.secondary, modifier = Modifier.size(13.dp))
                    Text("Sumário da análise", style = AthlyType.semibold(16), color = AthlyColor.textPrimary)
                }

                val cards = buildList {
                    add("Período analisado" to analysis.period)
                    add("Corridas analisadas" to "${analysis.runsAnalyzed}")
                    add("Distância média" to String.format(Locale.US, "%.1f km", analysis.avgDistanceKm))
                    add("Distância total" to String.format(Locale.US, "%.1f km", analysis.totalDistanceKm))
                    add("Pace médio" to analysis.avgPace)
                    analysis.avgHeartRate?.takeIf { it > 0 }?.let {
                        add("FC média" to "${it.roundToInt()} bpm")
                    }
                }
                cards.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        row.forEach { (label, value) -> SummaryMetricCard(label, value, Modifier.weight(1f)) }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryMetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(AthlyColor.surfaceDark)
            .border(1.dp, AthlyColor.glassBorder, RoundedCornerShape(10.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label, style = AthlyType.body(11), color = AthlyColor.textTertiary)
        Text(value, style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
    }
}

@Composable
private fun MetricChip(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, style = AthlyType.semibold(13), color = AthlyColor.textPrimary, maxLines = 1)
        Text(label, style = AthlyType.body(10), color = AthlyColor.textTertiary, maxLines = 1)
    }
}

@Composable
private fun ChipDivider(height: androidx.compose.ui.unit.Dp) {
    Box(Modifier.width(1.dp).height(height).background(AthlyColor.glassBorder))
}
