package com.athly.runner.feature.run

import android.content.Context
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.cue.CueOrchestrator
import com.athly.runner.core.data.RunStore
import com.athly.runner.core.data.UserPreferences
import com.athly.runner.core.location.LocationDataSource
import com.athly.runner.core.location.RunLocationService
import com.athly.runner.core.navigation.RunUiState
import com.athly.runner.data.mapper.toDomain
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.repository.HealthRepository
import com.athly.runner.domain.model.RunSession
import com.athly.runner.domain.run.RunMetrics
import com.athly.runner.domain.run.RunResult
import com.athly.runner.domain.run.RunState
import com.athly.runner.domain.run.RunTracker
import com.athly.runner.core.common.AthlyResult
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Estado de tela do fluxo de corrida além das métricas (que vêm do tracker). */
data class RunScreenState(
    val showSummary: Boolean = false,
    val lastRunResult: RunResult? = null,
    val isSaving: Boolean = false,
    val isSaved: Boolean = false,
    val saveError: String? = null,
    /** Id retornado pelo Health Connect write — usado no `RunWorkoutLink`/`completeWorkout` (prompt 17). */
    val healthConnectId: String? = null,
)

/**
 * Envolve o [RunTracker] (07) — espelha `RunViewModel` do iOS. Expõe as métricas ao vivo, a localização
 * de pré-corrida (para o mapa + indicador de GPS) e o estado do resumo. Coordena o foreground service
 * (06) e o flag global [RunUiState] (05) que esconde a bottom nav. O salvar/resumo real é do prompt 09.
 */
@HiltViewModel
class RunViewModel @Inject constructor(
    private val tracker: RunTracker,
    private val locationDataSource: LocationDataSource,
    private val runUiState: RunUiState,
    private val userPreferences: UserPreferences,
    private val runStore: RunStore,
    private val healthRepository: HealthRepository,
    // Injetado para materializar o singleton (ele assina tracker.cues no init) — prompt 10.
    private val cueOrchestrator: CueOrchestrator,
    @ApplicationContext private val appContext: Context,
) : ViewModel() {

    val metrics: StateFlow<RunMetrics> = tracker.metrics

    private val _screenState = MutableStateFlow(RunScreenState())
    val screenState: StateFlow<RunScreenState> = _screenState.asStateFlow()

    private val _currentLocation = MutableStateFlow<Location?>(null)
    val currentLocation: StateFlow<Location?> = _currentLocation.asStateFlow()

    private var previewJob: Job? = null

    init {
        // Peso do usuário para o cálculo de calorias (default 70).
        viewModelScope.launch {
            userPreferences.weightKg.collect { tracker.userWeightKg = it ?: 70.0 }
        }
        // Esconde a bottom nav enquanto a corrida está ativa OU o resumo está aberto (isRunInProgress do iOS).
        viewModelScope.launch {
            combine(tracker.metrics, _screenState) { m, s -> isActive(m.state) || s.showSummary }
                .distinctUntilChanged()
                .collect { runUiState.setRunInProgress(it) }
        }
        // Treino prescrito escolhido no Dashboard/Plano ("Iniciar treino agora") — carrega a playlist.
        viewModelScope.launch {
            runUiState.pendingWorkout.collect { setPendingWorkout(it) }
        }
    }

    private fun isActive(state: RunState) = state == RunState.RUNNING || state == RunState.PAUSED

    /** Coleta localização em foreground (sem FGS) para o mapa/indicador de GPS da pré-corrida. */
    fun startLocationPreview() {
        if (previewJob != null) return
        previewJob = viewModelScope.launch {
            locationDataSource.locationFlow().collect { _currentLocation.value = it }
        }
    }

    fun stopLocationPreview() {
        previewJob?.cancel()
        previewJob = null
    }

    fun start() {
        stopLocationPreview()
        RunLocationService.start(appContext, workoutTitle = pendingWorkoutTitle)
        tracker.start()
    }

    fun pause() = tracker.pause()

    fun resume() = tracker.resume()

    fun finish() {
        val result = tracker.stop()
        cueOrchestrator.stopAll()
        RunLocationService.stop(appContext)
        _screenState.update { it.copy(showSummary = true, lastRunResult = result) }
    }

    fun discard() {
        tracker.discard()
        cueOrchestrator.stopAll()
        RunLocationService.stop(appContext)
        _screenState.value = RunScreenState()
    }

    fun dismissSummary() {
        _screenState.value = RunScreenState()
    }

    /**
     * Salva a corrida — espelha `saveRun` do iOS: persiste local (Room) primeiro; o Health write é
     * best-effort e não bloqueia nem reverte o save local (impl real no prompt 12).
     */
    fun saveRun() {
        val result = _screenState.value.lastRunResult ?: return
        if (_screenState.value.isSaved || _screenState.value.isSaving) return
        viewModelScope.launch {
            _screenState.update { it.copy(isSaving = true, saveError = null) }
            val session = result.toRunSession()
            try {
                runStore.add(session)
            } catch (e: Exception) {
                _screenState.update { it.copy(isSaving = false, saveError = "Não foi possível salvar a corrida.") }
                return@launch
            }
            // Health Connect (best-effort) — falha não reverte o save local; em sucesso guarda o id.
            val healthId = runCatching { healthRepository.saveRun(session) }.getOrNull()
                .let { (it as? AthlyResult.Success)?.data }
            _screenState.update { it.copy(isSaving = false, isSaved = true, healthConnectId = healthId) }
        }
    }

    fun skipSegment() = tracker.skipSegment()

    private fun RunResult.toRunSession(): RunSession = RunSession(
        startDate = startDate,
        endDate = endDate,
        distanceMeters = distanceMeters,
        durationSeconds = durationSeconds,
        averagePaceSecondsPerKm = averagePaceSecondsPerKm,
        elevationGainMeters = elevationGainMeters,
        caloriesBurned = caloriesBurned,
        status = "completed",
        sportType = "running",
        routePoints = routePoints,
        splits = splits,
        synced = false,
    )

    /** Título do treino prescrito — vai para a notificação viva (11), como o `workoutTitle` da Live Activity. */
    private var pendingWorkoutTitle: String? = null

    /** Carrega a playlist de segmentos do treino agendado (Dashboard/Plan → Run). */
    fun setPendingWorkout(workout: WorkoutDto?) {
        pendingWorkoutTitle = workout?.title
        tracker.loadPlaylist(workout?.segments?.toDomain())
    }

    override fun onCleared() {
        stopLocationPreview()
        super.onCleared()
    }
}
