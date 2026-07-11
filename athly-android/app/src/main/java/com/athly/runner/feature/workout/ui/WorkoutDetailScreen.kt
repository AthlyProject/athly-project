package com.athly.runner.feature.workout.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.mapper.toDomain
import com.athly.runner.data.remote.dto.WorkoutBlockDto
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutStatus
import com.athly.runner.domain.model.Segment
import com.athly.runner.domain.model.SegmentEndBy
import com.athly.runner.domain.model.SegmentEndCondition
import com.athly.runner.domain.model.SegmentKind
import com.athly.runner.feature.common.SportBadge
import com.athly.runner.feature.common.StatusBadge
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Detalhe do treino — espelha `WorkoutDetailView` do iOS: header (🎯/sport/status/data/intensidade),
 * descrição, árvore de segmentos recursiva OU blocos legados, e Concluir/Pular quando agendado.
 * ("Iniciar treino" cross-tab fica para a integração do dashboard, 19.)
 */
@Composable
fun WorkoutDetailScreen(
    workout: WorkoutDto,
    onDismiss: () -> Unit,
    onComplete: () -> Unit,
    onSkip: () -> Unit,
) {
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
            Text(
                workout.title,
                style = AthlyType.semibold(17),
                color = AthlyColor.textPrimary,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onDismiss) {
                Text("Fechar", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp)
                .padding(bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            HeaderSection(workout)

            workout.description?.takeIf { it.isNotEmpty() }?.let { desc ->
                Column(
                    modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Descrição", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
                    Text(desc, style = AthlyType.body(15), color = AthlyColor.textSecondary)
                }
            }

            val segments = remember(workout) { workout.segments?.toDomain()?.segments.orEmpty() }
            when {
                segments.isNotEmpty() -> {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Estrutura do treino",
                            style = AthlyType.semibold(15),
                            color = AthlyColor.textPrimary,
                            modifier = Modifier.padding(horizontal = 4.dp),
                        )
                        segments.forEach { SegmentNode(it) }
                    }
                }

                workout.blocks.isNotEmpty() -> {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            "Blocos do treino",
                            style = AthlyType.semibold(15),
                            color = AthlyColor.textPrimary,
                            modifier = Modifier.padding(horizontal = 4.dp),
                        )
                        workout.blocks.forEachIndexed { index, block -> BlockCard(block, index + 1) }
                    }
                }

                else -> NoBlocksCard()
            }

            if (workout.status == WorkoutStatus.SCHEDULED) {
                AthlyGradientButton(
                    text = "Concluir treino",
                    onClick = onComplete,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                )
                TextButton(onClick = onSkip, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text("Pular treino", style = AthlyType.body(15), color = AthlyColor.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun HeaderSection(workout: WorkoutDto) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (workout.isGoalAttempt == true) {
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
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SportBadge(workout.sportType)
            Spacer(Modifier.weight(1f))
            StatusBadge(workout.status)
        }
        Text(
            text = longDateFormatter.format(workout.parsedDate.atZone(ZoneId.systemDefault())),
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
        )
        workout.intensity?.let { intensity ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.Bolt, null, tint = AthlyColor.primary, modifier = Modifier.size(14.dp))
                Text(
                    "Intensidade ${intensity.toInt()}/10",
                    style = AthlyType.body(14),
                    color = AthlyColor.textSecondary,
                )
            }
        }
    }
}

// MARK: - Árvore de segmentos (composable recursivo)

@Composable
private fun SegmentNode(segment: Segment) {
    if (segment.kind == SegmentKind.SET) SetNode(segment) else LeafNode(segment)
}

@Composable
private fun SetNode(segment: Segment) {
    var expanded by rememberSaveable(segment.id) { mutableStateOf(true) }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(AthlyColor.surfaceCard)
                .border(1.dp, AthlyColor.primary.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                ) { expanded = !expanded }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "${segment.repetitions ?: 1}×",
                fontFamily = SpaceGrotesk,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = AthlyColor.primary,
            )
            Text(segment.label ?: "Série", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
            Spacer(Modifier.weight(1f))
            Icon(
                if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown,
                null,
                tint = AthlyColor.textTertiary,
                modifier = Modifier.size(16.dp),
            )
        }

        if (expanded) {
            segment.children.orEmpty().forEach { child ->
                Box(Modifier.padding(start = 16.dp)) { SegmentNode(child) }
            }
        }
    }
}

@Composable
private fun LeafNode(segment: Segment) {
    val color = leafKindColor(segment.kind)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(10.dp))
            .background(AthlyColor.surfaceCard),
    ) {
        Box(
            Modifier
                .width(4.dp)
                .fillMaxHeight()
                .background(color, RoundedCornerShape(2.dp)),
        )
        Column(
            modifier = Modifier.weight(1f).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    segment.label ?: leafKindLabel(segment.kind),
                    style = AthlyType.semibold(14),
                    color = AthlyColor.textPrimary,
                    modifier = Modifier.weight(1f),
                )
                segment.end?.let { end ->
                    Text(
                        text = formatEnd(end),
                        fontFamily = SpaceGrotesk,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = color,
                    )
                }
            }

            (segment.cue ?: segment.notes)?.takeIf { it.isNotEmpty() }?.let { text ->
                Text(text, style = AthlyType.body(13), color = AthlyColor.textSecondary)
            }

            segment.target?.let { t ->
                val paceMin = t.paceSecPerKmMin
                val paceMax = t.paceSecPerKmMax
                when {
                    paceMin != null && paceMax != null ->
                        TargetLabel(Icons.Filled.Speed, "Ritmo ${formatPace(paceMin)}–${formatPace(paceMax)}/km")

                    paceMin != null ->
                        TargetLabel(Icons.Filled.Speed, "Ritmo ≥ ${formatPace(paceMin)}/km")

                    else -> Unit
                }
                t.hrZone?.let { TargetLabel(Icons.Filled.Favorite, "Zona $it") }
                t.exercise?.let { TargetLabel(Icons.Filled.FitnessCenter, it) }
            }
        }
    }
}

@Composable
private fun TargetLabel(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(12.dp))
        Text(text, style = AthlyType.body(12), color = AthlyColor.textTertiary)
    }
}

private fun leafKindColor(kind: SegmentKind): Color = when (kind) {
    SegmentKind.WARMUP -> Color(0xFFF97316)
    SegmentKind.WORK -> AthlyColor.primary
    SegmentKind.RECOVERY -> Color(0xFF3B82F6)
    SegmentKind.COOLDOWN -> Color(0xFF14B8A6)
    SegmentKind.REST -> Color(0xFF9CA3AF)
    else -> AthlyColor.secondary
}

private fun leafKindLabel(kind: SegmentKind): String = when (kind) {
    SegmentKind.WARMUP -> "Aquecimento"
    SegmentKind.WORK -> "Tiro"
    SegmentKind.RECOVERY -> "Recuperação"
    SegmentKind.COOLDOWN -> "Desaquecimento"
    SegmentKind.REST -> "Descanso"
    else -> "Bloco"
}

private fun formatEnd(end: SegmentEndCondition): String = when (end.by) {
    SegmentEndBy.DISTANCE_M -> {
        val m = end.value.toInt()
        if (m >= 1000) String.format(Locale.US, "%.1f km", m / 1000.0) else "$m m"
    }

    SegmentEndBy.DURATION_SEC -> {
        val s = end.value.toInt()
        when {
            s >= 3600 -> String.format(Locale.US, "%dh%02d", s / 3600, (s % 3600) / 60)
            s >= 60 -> String.format(Locale.US, "%d:%02d", s / 60, s % 60)
            else -> "${s}s"
        }
    }

    SegmentEndBy.REPS -> "${end.value.toInt()} reps"
}

private fun formatPace(sec: Int): String = String.format(Locale.US, "%d:%02d", sec / 60, sec % 60)

// MARK: - Blocos legados

@Composable
private fun BlockCard(block: WorkoutBlockDto, index: Int) {
    val title = when (block.type.lowercase()) {
        "warmup", "aquecimento" -> "Aquecimento"
        "cooldown", "desaquecimento" -> "Desaquecimento"
        "rest", "descanso" -> "Descanso"
        "run", "corrida" -> "Corrida"
        else -> block.type.replaceFirstChar { it.uppercase() }
    }

    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(Icons.AutoMirrored.Filled.ListAlt, null, tint = AthlyColor.primary, modifier = Modifier.size(18.dp))
            Text("$index. $title", style = AthlyType.semibold(15), color = AthlyColor.textPrimary)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            block.resolvedDuration?.let { d ->
                Text(formatBlockDuration(d), style = AthlyType.body(13), color = AthlyColor.textSecondary)
            }
            block.resolvedDistance?.let { dist ->
                Text(formatBlockDistance(dist), style = AthlyType.body(13), color = AthlyColor.textSecondary)
            }
            block.targetPace?.takeIf { it.isNotEmpty() }?.let { pace ->
                Text("Ritmo $pace/km", style = AthlyType.body(13), color = AthlyColor.textSecondary)
            }
        }

        block.instructions?.takeIf { it.isNotEmpty() }?.let { instructions ->
            Text(instructions, style = AthlyType.body(14), color = AthlyColor.textSecondary)
        }
    }
}

private fun formatBlockDuration(value: Double): String {
    if (value < 60) return "${value.toInt()} min"
    val min = value.toInt() / 60
    val sec = value.toInt() % 60
    return if (sec > 0) "${min}min ${sec}s" else "$min min"
}

private fun formatBlockDistance(km: Double): String =
    if (km < 1) "${(km * 1000).toInt()} m" else String.format(Locale.US, "%.2f km", km)

@Composable
private fun NoBlocksCard() {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Icons.AutoMirrored.Filled.ListAlt, null, tint = AthlyColor.textTertiary, modifier = Modifier.size(36.dp))
        Text(
            "Nenhum bloco definido para este treino",
            style = AthlyType.body(15),
            color = AthlyColor.textSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

private val longDateFormatter = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale("pt", "BR"))
