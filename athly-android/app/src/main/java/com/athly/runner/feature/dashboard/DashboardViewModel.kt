package com.athly.runner.feature.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.data.RunStore
import com.athly.runner.core.data.UserPreferences
import com.athly.runner.core.navigation.RunUiState
import com.athly.runner.data.remote.dto.WorkoutDto
import com.athly.runner.domain.model.RunSession
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/**
 * Dados próprios do Dashboard — nome do usuário e corridas recentes (barras dos 7 dias, do
 * `RunStore` como no iOS). O plano (treino de hoje, progresso, streak) vem do
 * `TrainingPlanViewModel` (14) na tela, para não duplicar a lógica.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    userPreferences: UserPreferences,
    runStore: RunStore,
    private val runUiState: RunUiState,
) : ViewModel() {

    val userName: StateFlow<String> = userPreferences.userName
        .map { it.orEmpty() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    /** `RunStore.sortedSessions` do iOS — o Flow do Room já vem ordenado por data desc. */
    val recentRuns: StateFlow<List<RunSession>> = runStore.sessions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** "Iniciar treino agora" — seta o pendente; o caller troca para a aba Run. */
    fun startWorkout(workout: WorkoutDto) {
        runUiState.setPendingWorkout(workout)
    }
}
