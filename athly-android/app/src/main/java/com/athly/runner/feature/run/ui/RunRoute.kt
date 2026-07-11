package com.athly.runner.feature.run.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.athly.runner.domain.run.RunState
import com.athly.runner.feature.run.RunViewModel

/**
 * Entrada da feature de corrida (aba Run) — espelha o `Group { switch }` do `RunStartView` iOS:
 * troca entre pré-corrida / ao vivo / resumo conforme o estado. Mantém a tela acesa durante a corrida.
 */
@Composable
fun RunRoute(viewModel: RunViewModel = hiltViewModel()) {
    val metrics by viewModel.metrics.collectAsStateWithLifecycle()
    val screen by viewModel.screenState.collectAsStateWithLifecycle()
    val currentLocation by viewModel.currentLocation.collectAsStateWithLifecycle()

    val active = metrics.state == RunState.RUNNING || metrics.state == RunState.PAUSED
    KeepScreenOn(active)

    when {
        active -> RunTrackingScreen(
            metrics = metrics,
            onPause = viewModel::pause,
            onResume = viewModel::resume,
            onFinish = viewModel::finish,
            onDiscard = viewModel::discard,
            onSkip = viewModel::skipSegment,
        )
        screen.showSummary -> RunSummaryScreen(
            result = screen.lastRunResult,
            screen = screen,
            onSave = viewModel::saveRun,
            onDismiss = viewModel::dismissSummary,
        )
        else -> RunStartScreen(
            currentLocation = currentLocation,
            onStart = viewModel::start,
            onStartPreview = viewModel::startLocationPreview,
            onStopPreview = viewModel::stopLocationPreview,
        )
    }
}

/** Mantém a tela acesa durante a corrida (FLAG_KEEP_SCREEN_ON via View); limpa ao sair. */
@Composable
private fun KeepScreenOn(enabled: Boolean) {
    val view = LocalView.current
    DisposableEffect(enabled) {
        view.keepScreenOn = enabled
        onDispose { view.keepScreenOn = false }
    }
}
