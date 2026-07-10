package com.athly.runner.feature.run.ui

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import androidx.compose.ui.text.font.FontWeight
import com.athly.runner.domain.run.RunMetrics
import com.athly.runner.domain.run.RunState

/**
 * Tela de corrida ao vivo — espelha `RunTrackingView` do iOS: timer grande, banner do segmento,
 * grid de métricas 2x2 (KM / PACE / ELEVACAO / KCAL) e controles pause/resume/stop.
 */
@Composable
fun RunTrackingScreen(
    metrics: RunMetrics,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onFinish: () -> Unit,
    onDiscard: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showStopDialog by remember { mutableStateOf(false) }
    val isPaused = metrics.state == RunState.PAUSED

    Box(modifier = modifier.fillMaxSize().ambientGlow().systemBarsPadding()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(bottom = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.weight(1f))

            // Timer grande
            Text(
                text = RunFormat.duration(metrics.elapsedSeconds),
                fontFamily = SpaceGrotesk,
                fontWeight = FontWeight.Bold,
                fontSize = 72.sp,
                color = AthlyColor.textPrimary,
            )
            Text("TEMPO", style = AthlyType.label, color = AthlyColor.textTertiary)

            Spacer(Modifier.weight(1f))

            metrics.currentSegment?.let { seg ->
                CurrentSegmentBanner(
                    segment = seg,
                    progress = metrics.segmentProgress,
                    next = metrics.nextSegment,
                    onSkip = onSkip,
                    modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 12.dp),
                )
            }

            MetricsGrid(metrics)

            Spacer(Modifier.weight(1f))

            ControlsPanel(
                isPaused = isPaused,
                onPause = onPause,
                onResume = onResume,
                onStop = { showStopDialog = true },
            )
        }
    }

    if (showStopDialog) {
        AlertDialog(
            onDismissRequest = { showStopDialog = false },
            containerColor = AthlyColor.surfaceCard,
            title = { Text("Finalizar corrida?", style = AthlyType.semibold(18), color = AthlyColor.textPrimary) },
            confirmButton = {
                Column {
                    TextButton(onClick = { showStopDialog = false; onFinish() }) {
                        Text("Finalizar e salvar", color = AthlyColor.primary)
                    }
                    TextButton(onClick = { showStopDialog = false; onDiscard() }) {
                        Text("Descartar", color = AthlyColor.error)
                    }
                    TextButton(onClick = { showStopDialog = false; onResume() }) {
                        Text("Continuar correndo", color = AthlyColor.textSecondary)
                    }
                }
            },
        )
    }
}

@Composable
private fun MetricsGrid(metrics: RunMetrics) {
    Column(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .athlyCard()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            MetricItem(RunFormat.distanceKm(metrics.distanceMeters), "KM", Icons.Filled.Straighten, Modifier.weight(1f))
            MetricDivider()
            MetricItem(RunFormat.paceNoSuffix(metrics.currentPaceSecPerKm), "PACE /KM", Icons.Filled.Speed, Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            MetricItem(RunFormat.whole(metrics.elevationGain), "ELEVACAO (M)", Icons.Filled.Terrain, Modifier.weight(1f))
            MetricDivider()
            MetricItem(RunFormat.whole(metrics.calories), "KCAL", Icons.Filled.LocalFireDepartment, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MetricItem(value: String, label: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, contentDescription = null, tint = AthlyColor.primary, modifier = Modifier.size(16.dp))
        Text(
            text = value,
            fontFamily = SpaceGrotesk,
            fontWeight = FontWeight.Bold,
            fontSize = 32.sp,
            color = AthlyColor.textPrimary,
            textAlign = TextAlign.Center,
        )
        Text(label, style = AthlyType.label, color = AthlyColor.textSecondary)
    }
}

@Composable
private fun MetricDivider() {
    Box(Modifier.width(1.dp).height(60.dp).background(AthlyColor.borderDark))
}

@Composable
private fun ControlsPanel(
    isPaused: Boolean,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (isPaused) {
            CircleControl(size = 64.dp, background = AthlyColor.error, icon = Icons.Filled.Stop, onClick = onStop)
            Spacer(Modifier.width(40.dp))
            CircleControl(size = 80.dp, gradient = true, icon = Icons.Filled.PlayArrow, onClick = onResume)
        } else {
            CircleControl(size = 80.dp, background = AthlyColor.warning, icon = Icons.Filled.Pause, onClick = onPause)
        }
    }
}

@Composable
private fun CircleControl(
    size: androidx.compose.ui.unit.Dp,
    icon: ImageVector,
    onClick: () -> Unit,
    background: Color = AthlyColor.primary,
    gradient: Boolean = false,
) {
    val base = Modifier.size(size).clip(CircleShape)
    Box(
        modifier = (if (gradient) base.background(com.athly.runner.core.designsystem.theme.AthlyGradient.neon) else base.background(background))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(size * 0.4f))
    }
}

/** Fundo com dois glows radiais ambiente — espelha os RadialGradient do RunTrackingView iOS. */
private fun Modifier.ambientGlow(): Modifier = this
    .background(AthlyColor.backgroundDark)
    .drawWithCache {
        val g1 = Brush.radialGradient(
            colors = listOf(AthlyColor.primary.copy(alpha = 0.12f), Color.Transparent),
            center = Offset(size.width * 0.2f, size.height * 0.15f),
            radius = size.minDimension * 0.9f,
        )
        val g2 = Brush.radialGradient(
            colors = listOf(AthlyColor.secondary.copy(alpha = 0.08f), Color.Transparent),
            center = Offset(size.width * 0.85f, size.height * 0.85f),
            radius = size.minDimension * 0.85f,
        )
        onDrawBehind {
            drawRect(g1)
            drawRect(g2)
        }
    }
