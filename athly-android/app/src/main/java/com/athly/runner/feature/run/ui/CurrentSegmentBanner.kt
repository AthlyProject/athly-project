package com.athly.runner.feature.run.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.domain.model.ActiveSegment
import com.athly.runner.domain.model.SegmentEndCondition
import com.athly.runner.domain.model.SegmentKind

/**
 * Banner do segmento ativo — espelha `CurrentSegmentBanner` do iOS: anel de progresso, label + badge
 * idx/total, texto do RESTANTE, botão skip e pílula "A seguir".
 */
@Composable
fun CurrentSegmentBanner(
    segment: ActiveSegment,
    progress: Double,
    next: ActiveSegment?,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val color = kindColor(segment.kind)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(AthlyColor.surfaceCard, RoundedCornerShape(16.dp))
                .border(1.dp, color.copy(alpha = 0.45f), RoundedCornerShape(16.dp))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ProgressRing(progress = progress, color = color)

            Column(verticalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(segment.label, style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
                    if (segment.setIndex != null && segment.setTotal != null) {
                        Text(
                            text = "${segment.setIndex}/${segment.setTotal}",
                            style = AthlyType.label,
                            color = color,
                            modifier = Modifier
                                .background(color.copy(alpha = 0.18f), CircleShape)
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                Text(
                    text = remainingText(segment, progress),
                    style = AthlyType.heading(22),
                    color = AthlyColor.textPrimary,
                )
            }

            Box(
                modifier = Modifier
                    .background(AthlyColor.backgroundDark, CircleShape)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                        onClick = onSkip,
                    )
                    .padding(10.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.SkipNext,
                    contentDescription = "Pular segmento",
                    tint = AthlyColor.textTertiary,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        if (next != null) {
            Row(
                modifier = Modifier
                    .background(AthlyColor.surfaceCard.copy(alpha = 0.6f), CircleShape)
                    .padding(horizontal = 12.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("A seguir:", style = AthlyType.label, color = AthlyColor.textTertiary)
                Text(next.label, style = AthlyType.label, color = AthlyColor.textSecondary)
                Text("·", style = AthlyType.label, color = AthlyColor.textTertiary)
                Text(RunFormat.endSummary(next.end), style = AthlyType.label, color = AthlyColor.textSecondary)
            }
        }
    }
}

@Composable
private fun ProgressRing(progress: Double, color: Color) {
    val animated by animateFloatAsState(
        targetValue = progress.coerceIn(0.0, 1.0).toFloat(),
        animationSpec = tween(durationMillis = 1000, easing = LinearEasing),
        label = "segmentProgress",
    )
    Canvas(modifier = Modifier.size(44.dp)) {
        val stroke = 4.dp.toPx()
        val arcSize = Size(size.width - stroke, size.height - stroke)
        val topLeft = Offset(stroke / 2, stroke / 2)
        drawArc(
            color = AthlyColor.borderDark,
            startAngle = 0f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke),
        )
        drawArc(
            color = color,
            startAngle = -90f,
            sweepAngle = animated * 360f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

private fun remainingText(segment: ActiveSegment, progress: Double): String {
    val done = progress * segment.end.value
    val remaining = maxOf(0.0, segment.end.value - done)
    return RunFormat.endSummary(SegmentEndCondition(by = segment.end.by, value = remaining))
}

/** Cores por tipo — espelha `kindColor` do iOS (teal/blue/orange/gray em hex equivalentes). */
private fun kindColor(kind: SegmentKind): Color = when (kind) {
    SegmentKind.WARMUP -> Color(0xFFF97316)
    SegmentKind.WORK -> AthlyColor.primary
    SegmentKind.RECOVERY -> Color(0xFF3B82F6)
    SegmentKind.COOLDOWN -> Color(0xFF14B8A6)
    SegmentKind.REST -> Color(0xFF9CA3AF)
    SegmentKind.SET, SegmentKind.UNKNOWN -> AthlyColor.primary
}
