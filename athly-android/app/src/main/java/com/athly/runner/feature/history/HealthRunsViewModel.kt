package com.athly.runner.feature.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.health.HealthConnectManager
import com.athly.runner.core.health.HealthPermissionGate
import com.athly.runner.domain.model.HealthRunItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Estados da lista — espelha o `State` do `HealthKitRunsViewModel` iOS. */
sealed interface HealthRunsUiState {
    data object Loading : HealthRunsUiState
    data object HealthUnavailable : HealthRunsUiState
    data class Error(val message: String) : HealthRunsUiState
    data object Empty : HealthRunsUiState
    data class Loaded(val runs: List<HealthRunItem>, val isRefreshing: Boolean = false) : HealthRunsUiState
}

/**
 * Histórico = Health Connect como fonte da verdade (não há store próprio de corridas — sobrevive a
 * reinstalação e inclui treinos de outros apps). Espelha `HealthKitRunsViewModel.loadWorkouts`:
 * indisponível → HealthUnavailable; senão pede read auth (uma vez, via gate) e lê as últimas 20.
 */
@HiltViewModel
class HealthRunsViewModel @Inject constructor(
    private val manager: HealthConnectManager,
    private val gate: HealthPermissionGate,
) : ViewModel() {

    private val _state = MutableStateFlow<HealthRunsUiState>(HealthRunsUiState.Loading)
    val state: StateFlow<HealthRunsUiState> = _state.asStateFlow()

    /** Permissões a pedir via contrato do Health Connect; a tela lança e chama [onPermissionResult]. */
    private val _permissionRequest = MutableStateFlow<Set<String>?>(null)
    val permissionRequest: StateFlow<Set<String>?> = _permissionRequest.asStateFlow()

    fun load(isRefresh: Boolean = false) {
        viewModelScope.launch {
            val current = _state.value
            if (isRefresh && current is HealthRunsUiState.Loaded) {
                _state.value = current.copy(isRefreshing = true)
            } else {
                _state.value = HealthRunsUiState.Loading
            }

            if (!manager.isAvailable) {
                _state.value = HealthRunsUiState.HealthUnavailable
                return@launch
            }

            // Read auth pedida dentro do load, uma vez por instalação (gate) — negação não trava a UI.
            if (!manager.hasReadPermissions() && gate.shouldRequestRead()) {
                gate.markReadRequested()
                _permissionRequest.value = manager.readPermissions
                return@launch
            }

            try {
                val runs = manager.readRunningSessions(limit = 20)
                _state.value = if (runs.isEmpty()) HealthRunsUiState.Empty else HealthRunsUiState.Loaded(runs)
            } catch (e: Exception) {
                _state.value = HealthRunsUiState.Error(
                    e.message ?: "Nao foi possivel carregar as corridas do Health Connect.",
                )
            }
        }
    }

    fun onPermissionResult() {
        _permissionRequest.value = null
        load()
    }

    fun retry() = load()
}
