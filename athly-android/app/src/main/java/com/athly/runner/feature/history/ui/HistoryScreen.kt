package com.athly.runner.feature.history.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.filled.HeartBroken
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.core.designsystem.component.AthlyGradientButton
import com.athly.runner.core.designsystem.component.athlyCard
import com.athly.runner.core.designsystem.theme.AthlyColor
import com.athly.runner.core.designsystem.theme.AthlyType
import com.athly.runner.domain.model.HealthRunItem
import com.athly.runner.feature.history.HealthRunsUiState
import com.athly.runner.feature.history.HealthRunsViewModel
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Aba Histórico — espelha `HistoryView` do iOS: delega para a lista de corridas do Health
 * (Health Connect = fonte da verdade; sem store próprio).
 */
@Composable
fun HistoryScreen(viewModel: HealthRunsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val permissionRequest by viewModel.permissionRequest.collectAsStateWithLifecycle()

    val permissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { viewModel.onPermissionResult() }

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(permissionRequest) {
        permissionRequest?.let { permissionLauncher.launch(it) }
    }

    Box(Modifier.fillMaxSize().historyGlow().systemBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            Text(
                "Histórico",
                style = AthlyType.heading(24),
                color = AthlyColor.textPrimary,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
            when (val s = state) {
                HealthRunsUiState.Loading -> CenteredSpinner()
                HealthRunsUiState.HealthUnavailable -> HealthUnavailableContent(onRetry = viewModel::retry)
                is HealthRunsUiState.Error -> ErrorContent(message = s.message, onRetry = viewModel::retry)
                HealthRunsUiState.Empty -> EmptyContent()
                is HealthRunsUiState.Loaded -> RunsList(
                    runs = s.runs,
                    isRefreshing = s.isRefreshing,
                    onRefresh = { viewModel.load(isRefresh = true) },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RunsList(runs: List<HealthRunItem>, isRefreshing: Boolean, onRefresh: () -> Unit) {
    PullToRefreshBox(isRefreshing = isRefreshing, onRefresh = onRefresh) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 12.dp, end = 12.dp, top = 4.dp, bottom = 96.dp,
            ),
        ) {
            items(runs, key = { it.id }) { run -> HealthRunCard(run) }
        }
    }
}

/** Card estilo Fitness + Athly — espelha `HealthKitRunCard`. */
@Composable
private fun HealthRunCard(item: HealthRunItem) {
    Column(
        modifier = Modifier.fillMaxWidth().athlyCard().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(cardDateTime(item), style = AthlyType.body(13), color = AthlyColor.textTertiary)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    Icons.AutoMirrored.Filled.DirectionsRun,
                    contentDescription = null,
                    tint = AthlyColor.primary,
                    modifier = Modifier.size(14.dp),
                )
                Text("Corrida", style = AthlyType.semibold(17), color = AthlyColor.textPrimary)
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            MainStat(item.formattedDuration, "Duracao", Modifier.weight(1f))
            StatDivider()
            MainStat("${item.formattedDistance} km", "Distancia", Modifier.weight(1f))
            StatDivider()
            MainStat("${item.formattedPace}/km", "Pace", Modifier.weight(1f))
        }

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            FooterStat(Icons.Filled.LocalFireDepartment, String.format(Locale.US, "%.0f kcal", item.activeEnergyBurned))
            item.elevationGainMeters?.takeIf { it > 0 }?.let { elevation ->
                FooterStat(Icons.Filled.Terrain, String.format(Locale.US, "%.0f m", elevation))
            }
        }
    }
}

@Composable
private fun MainStat(value: String, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, style = AthlyType.semibold(16), color = AthlyColor.textPrimary, maxLines = 1)
        Text(label, style = AthlyType.body(11), color = AthlyColor.textTertiary)
    }
}

@Composable
private fun StatDivider() {
    Box(Modifier.width(1.dp).height(44.dp).background(AthlyColor.borderDark))
}

@Composable
private fun FooterStat(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, contentDescription = null, tint = AthlyColor.textSecondary, modifier = Modifier.size(13.dp))
        Text(text, style = AthlyType.body(12), color = AthlyColor.textSecondary)
    }
}

// MARK: - Estados vazios/erro (strings pt-BR do iOS, adaptadas para Health Connect)

@Composable
private fun CenteredSpinner() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = AthlyColor.primary)
    }
}

@Composable
private fun EmptyContent() {
    StateContent(
        icon = Icons.AutoMirrored.Filled.DirectionsRun,
        iconTint = AthlyColor.textTertiary,
        title = "Nenhuma corrida encontrada",
        message = "Nao ha corridas no Health Connect neste dispositivo. Corridas de outros apps aparecem aqui.",
    )
}

@Composable
private fun HealthUnavailableContent(onRetry: () -> Unit) {
    StateContent(
        icon = Icons.Filled.HeartBroken,
        iconTint = AthlyColor.textTertiary,
        title = "Health Connect indisponivel",
        message = "O Health Connect nao esta disponivel neste dispositivo. Instale ou atualize o app Health Connect para ver seu historico.",
        onRetry = onRetry,
    )
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    StateContent(
        icon = Icons.Filled.Warning,
        iconTint = AthlyColor.warning,
        title = "Erro ao carregar",
        message = message,
        onRetry = onRetry,
    )
}

@Composable
private fun StateContent(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    message: String,
    onRetry: (() -> Unit)? = null,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, style = AthlyType.heading(18), color = AthlyColor.textPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(message, style = AthlyType.body(14), color = AthlyColor.textSecondary, textAlign = TextAlign.Center)
        if (onRetry != null) {
            Spacer(Modifier.height(20.dp))
            AthlyGradientButton(text = "Tentar novamente", onClick = onRetry)
        }
    }
}

/** Hoje → só hora; senão data abreviada + hora — espelha `dateTimeText` do card iOS. */
private fun cardDateTime(item: HealthRunItem): String {
    val zone = ZoneId.systemDefault()
    val local = item.startDate.atZone(zone)
    return if (local.toLocalDate() == LocalDate.now(zone)) {
        local.format(timeFormatter)
    } else {
        local.format(dateTimeFormatter)
    }
}

private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale("pt", "BR"))
private val dateTimeFormatter = DateTimeFormatter.ofPattern("d 'de' MMM 'de' yyyy, HH:mm", Locale("pt", "BR"))

/** Fundo dark + glows radiais (primary topo-esquerda, secondary canto inferior) — tema do iOS. */
private fun Modifier.historyGlow(): Modifier = this
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
