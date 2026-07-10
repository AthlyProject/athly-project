package com.athly.runner.feature.run.ui

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
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SelfImprovement
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Tag
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.athly.runner.core.common.Formatters
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyGradient
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.core.designsystem.theme.SpaceGrotesk
import com.athly.runner.domain.model.SegmentKind
import com.athly.runner.domain.model.Split
import com.athly.runner.domain.run.RunResult
import com.athly.runner.domain.run.SegmentRecord
import com.athly.runner.feature.common.SummaryMap
import com.athly.runner.feature.run.RunScreenState
import com.google.android.gms.maps.model.LatLng
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Resumo da corrida — espelha `RunSummaryView` do iOS: header de sucesso, mapa da rota (polyline
 * enquadrada + markers início/fim), grid de 6 stats, blocos executados (treino estruturado), splits por
 * km e o rodapé de save (auto-dispara ao aparecer; local-primeiro, Health best-effort).
 * I.A Report / câmera / feedback do treino prescrito ficam para prompts futuros (17+).
 */
@Composable
fun RunSummaryScreen(
    result: RunResult?,
    screen: RunScreenState,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // `.task { await saveRun() }` do iOS — dispara o save uma vez ao aparecer.
    LaunchedEffect(Unit) { onSave() }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AthlyColor.backgroundDark)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SummaryHeader(result)

        if (result != null) {
            if (result.routePoints.size >= 2) {
                SummaryMap(
                    points = result.routePoints.map { LatLng(it.latitude, it.longitude) },
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(16.dp)),
                )
            }

            StatsGrid(result)

            val blocks = remember(result) { displayableSegments(result.segmentRecords) }
            if (blocks.isNotEmpty()) ExecutedSegmentsSection(blocks)

            if (result.splits.isNotEmpty()) SplitsSection(result.splits)
        }

        SaveFooter(screen = screen, onDismiss = onDismiss)
    }
}

@Composable
private fun SummaryHeader(result: RunResult?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 24.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.CheckCircle,
            contentDescription = null,
            tint = AthlyColor.success,
            modifier = Modifier.size(56.dp),
        )
        Text("Corrida finalizada!", style = AthlyType.heading(22), color = AthlyColor.textPrimary)
        if (result != null) {
            Text(
                text = summaryDateFormatter.format(result.startDate.atZone(ZoneId.systemDefault())),
                style = AthlyType.body(15),
                color = AthlyColor.textSecondary,
            )
        }
    }
}

/** `.formatted(date: .abbreviated, time: .shortened)` do iOS. */
private val summaryDateFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("d 'de' MMM 'de' yyyy, HH:mm", Locale("pt", "BR"))

// MARK: - Stats grid (6 cards, 2 colunas)

private data class SummaryStat(val icon: ImageVector, val value: String, val label: String)

@Composable
private fun StatsGrid(result: RunResult) {
    val stats = listOf(
        SummaryStat(Icons.Filled.Straighten, Formatters.distanceKm(result.distanceMeters), "Distancia"),
        SummaryStat(Icons.Filled.Schedule, Formatters.duration(result.durationSeconds), "Duracao"),
        SummaryStat(Icons.Filled.Speed, Formatters.pace(result.averagePaceSecondsPerKm), "Pace medio"),
        SummaryStat(Icons.Filled.Terrain, String.format(Locale.US, "%.0f m", result.elevationGainMeters), "Elevacao"),
        SummaryStat(Icons.Filled.LocalFireDepartment, String.format(Locale.US, "%.0f kcal", result.caloriesBurned), "Calorias"),
        SummaryStat(Icons.Filled.Tag, "${result.splits.size}", "Splits"),
    )
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        stats.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEach { stat -> StatCard(stat, Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun StatCard(stat: SummaryStat, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.athlyCard().padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(stat.icon, contentDescription = null, tint = AthlyColor.primary, modifier = Modifier.size(20.dp))
        Text(
            text = stat.value,
            style = AthlyType.heading(20),
            color = AthlyColor.textPrimary,
            maxLines = 1,
            textAlign = TextAlign.Center,
        )
        Text(stat.label, style = AthlyType.body(12), color = AthlyColor.textSecondary)
    }
}

// MARK: - Blocos executados (treino estruturado)

/** `RunExecutedSegmentsSection.displayableSegments` do iOS: sem rest/unknown nem resíduos minúsculos. */
private fun displayableSegments(records: List<SegmentRecord>): List<SegmentRecord> =
    records.filter {
        it.kind != SegmentKind.REST &&
            it.kind != SegmentKind.UNKNOWN &&
            (it.distanceMeters > 5 || it.durationSeconds > 3)
    }

@Composable
private fun ExecutedSegmentsSection(segments: List<SegmentRecord>) {
    SummaryListSection(title = "Blocos executados") {
        segments.forEachIndexed { index, segment ->
            SegmentRow(segment)
            if (index < segments.size - 1) SectionDivider()
        }
    }
}

@Composable
private fun SegmentRow(segment: SegmentRecord) {
    val isWork = segment.kind == SegmentKind.WORK
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            imageVector = segmentIcon(segment.kind),
            contentDescription = null,
            tint = if (isWork) AthlyColor.primary else AthlyColor.textSecondary,
            modifier = Modifier.size(16.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
            Text(
                text = if (segment.skipped) "${segment.label} (pulado)" else segment.label,
                style = AthlyType.medium(15),
                color = AthlyColor.textPrimary,
            )
            Text(
                text = "${segmentDistanceText(segment.distanceMeters)} · ${Formatters.duration(segment.durationSeconds)}",
                style = AthlyType.body(12),
                color = AthlyColor.textSecondary,
            )
        }
        if (segment.distanceMeters >= 100 && segment.paceSecondsPerKm > 0) {
            Text(
                text = RunFormat.paceNoSuffix(segment.paceSecondsPerKm),
                fontFamily = SpaceGrotesk,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = if (isWork) AthlyColor.primary else AthlyColor.textPrimary,
            )
            Text("/km", style = AthlyType.body(11), color = AthlyColor.textSecondary)
        }
    }
}

private fun segmentIcon(kind: SegmentKind): ImageVector = when (kind) {
    SegmentKind.WARMUP -> Icons.Filled.DirectionsWalk
    SegmentKind.WORK -> Icons.Filled.Bolt
    SegmentKind.RECOVERY -> Icons.Filled.Air
    SegmentKind.COOLDOWN -> Icons.Filled.SelfImprovement
    else -> Icons.Filled.Circle
}

private fun segmentDistanceText(meters: Double): String =
    if (meters >= 1000) String.format(Locale.US, "%.2f km", meters / 1000.0)
    else String.format(Locale.US, "%.0f m", meters)

// MARK: - Splits

@Composable
private fun SplitsSection(splits: List<Split>) {
    SummaryListSection(title = "Splits") {
        splits.forEachIndexed { index, split ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Km ${split.kilometer}", style = AthlyType.medium(16), color = AthlyColor.textPrimary)
                Spacer(Modifier.weight(1f))
                Text(
                    text = RunFormat.paceNoSuffix(split.paceSecondsPerKm),
                    fontFamily = SpaceGrotesk,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = AthlyColor.primary,
                )
                Spacer(Modifier.width(4.dp))
                Text("/km", style = AthlyType.body(12), color = AthlyColor.textSecondary)
            }
            if (index < splits.size - 1) SectionDivider()
        }
    }
}

// MARK: - Section container (card com borda gradiente) — espelha `RunSummaryListSection`

@Composable
private fun SummaryListSection(title: String, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title, style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(AthlyColor.surfaceCard)
                .background(
                    Brush.linearGradient(
                        listOf(AthlyColor.primary.copy(alpha = 0.08f), Color.Transparent),
                    ),
                )
                .border(1.dp, AthlyGradient.gradientBorder, RoundedCornerShape(16.dp)),
        ) {
            content()
        }
    }
}

@Composable
private fun SectionDivider() {
    Box(
        Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .height(1.dp)
            .background(AthlyColor.borderDark),
    )
}

// MARK: - Save footer

@Composable
private fun SaveFooter(screen: RunScreenState, onDismiss: () -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 32.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (screen.isSaving) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 8.dp),
            ) {
                CircularProgressIndicator(color = AthlyColor.primary, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                Text("Salvando corrida...", style = AthlyType.body(15), color = AthlyColor.textSecondary)
            }
        } else if (screen.saveError != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Filled.WifiOff, contentDescription = null, tint = AthlyColor.warning, modifier = Modifier.size(14.dp))
                Text(screen.saveError, style = AthlyType.body(13), color = AthlyColor.warning, textAlign = TextAlign.Center)
            }
        }

        AthlyGradientButton(
            text = if (screen.isSaved) "Corrida salva!" else "Salvando...",
            onClick = onDismiss,
            enabled = !screen.isSaving,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
