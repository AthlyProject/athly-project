package com.athly.runner.core.navigation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * VM do shell — expõe o flag compartilhado [RunUiState] à UI. Como o estado real vive no singleton,
 * a barra (MainScaffold) e o placeholder do Run compartilham o mesmo valor mesmo com instâncias distintas.
 */
@HiltViewModel
class ShellViewModel @Inject constructor(
    private val runUiState: RunUiState,
) : ViewModel() {
    val isRunInProgress: StateFlow<Boolean> = runUiState.isRunInProgress

    fun setRunInProgress(value: Boolean) = runUiState.setRunInProgress(value)
}
