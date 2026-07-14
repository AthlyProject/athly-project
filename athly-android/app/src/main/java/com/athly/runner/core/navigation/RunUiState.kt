package com.athly.runner.core.navigation

import com.athly.runner.data.remote.dto.WorkoutDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Estado global do shell ligado à corrida — espelha `isRunInProgress` + `pendingWorkout` do
 * `MainTabView` iOS. `isRunInProgress` esconde a FloatingTabBar; `pendingWorkout` é o treino
 * prescrito escolhido no Dashboard/Plano ("Iniciar treino agora") que a aba Run consome ao abrir.
 */
@Singleton
class RunUiState @Inject constructor() {
    private val _isRunInProgress = MutableStateFlow(false)
    val isRunInProgress: StateFlow<Boolean> = _isRunInProgress.asStateFlow()

    private val _pendingWorkout = MutableStateFlow<WorkoutDto?>(null)
    val pendingWorkout: StateFlow<WorkoutDto?> = _pendingWorkout.asStateFlow()

    fun setRunInProgress(value: Boolean) {
        _isRunInProgress.value = value
    }

    fun setPendingWorkout(workout: WorkoutDto?) {
        _pendingWorkout.value = workout
    }
}
