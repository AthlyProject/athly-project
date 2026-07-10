package com.athly.runner.feature.workout

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.data.RunWorkoutLinkStore
import com.athly.runner.core.health.HealthConnectManager
import com.athly.runner.data.mapper.parsedDate
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.data.remote.dto.WorkoutFeedbackRequest
import com.athly.runner.data.repository.WorkoutRepository
import com.athly.runner.domain.model.HealthRunItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/** Estado do sheet de conclusão — espelha os `@State` do `WorkoutCompletionSheet` iOS. */
data class CompletionUiState(
    val isLoading: Boolean = true,
    val runs: List<HealthRunItem> = emptyList(),
    val loadError: String? = null,
    val isSubmitting: Boolean = false,
    val submitError: String? = null,
)

/**
 * Carrega as corridas candidatas do Health Connect (janela D..D+2, sem já-linkadas) e envia o
 * feedback — espelha `loadCandidateRuns`/`submitFeedback` do iOS. Concluir/pular em si é do
 * `TrainingPlanViewModel` (14), chamado pelo caller com a corrida selecionada.
 */
@HiltViewModel
class WorkoutCompletionViewModel @Inject constructor(
    private val healthConnectManager: HealthConnectManager,
    private val linkStore: RunWorkoutLinkStore,
    private val workoutRepository: WorkoutRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CompletionUiState())
    val state: StateFlow<CompletionUiState> = _state.asStateFlow()

    /** Janela [startOfDay(D), D+3): o dia do treino + 2 dias seguintes, corridas órfãs, asc. */
    fun loadCandidateRuns(workout: WorkoutDto) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, loadError = null) }

            if (!healthConnectManager.isAvailable) {
                _state.update {
                    it.copy(isLoading = false, loadError = "Health Connect não disponível neste dispositivo.")
                }
                return@launch
            }

            try {
                val zone = ZoneId.systemDefault()
                val windowStart = workout.parsedDate.atZone(zone).toLocalDate().atStartOfDay(zone).toInstant()
                val windowEnd = windowStart.plusSeconds(3 * 24 * 3600)

                val allRuns = healthConnectManager.readRunningSessions(limit = 30)
                val inWindow = allRuns.filter { it.startDate >= windowStart && it.startDate < windowEnd }
                val orphanIds = linkStore.allOrphanCandidates(inWindow.map { it.id }).toSet()

                _state.update { current ->
                    current.copy(
                        isLoading = false,
                        runs = inWindow.filter { it.id in orphanIds }.sortedBy { it.startDate },
                    )
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(isLoading = false, loadError = e.message ?: "Erro ao acessar o Health Connect.")
                }
            }
        }
    }

    fun submitFeedback(workoutId: String, completed: Boolean, effort: Int, fatigue: Int, onDone: () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, submitError = null) }
            val result = workoutRepository.submitFeedback(
                workoutId,
                WorkoutFeedbackRequest(completed = completed, effort = effort, fatigue = fatigue),
            )
            when (result) {
                is AthlyResult.Success -> {
                    _state.update { it.copy(isSubmitting = false) }
                    onDone()
                }

                is AthlyResult.Failure -> _state.update {
                    it.copy(
                        isSubmitting = false,
                        submitError = "Não foi possível enviar o feedback. Tente novamente ou use \"Pular por agora\".",
                    )
                }
            }
        }
    }
}
