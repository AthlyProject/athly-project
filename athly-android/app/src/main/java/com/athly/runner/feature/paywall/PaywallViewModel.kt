package com.athly.runner.feature.paywall

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PaywallUiState(
    val isWorking: Boolean = false,
    val errorMessage: String? = null,
)

/** Estado da PaywallScreen — compra/restore via [EntitlementManager]; erros inline como o iOS. */
@HiltViewModel
class PaywallViewModel @Inject constructor(
    private val entitlementManager: EntitlementManager,
) : ViewModel() {

    private val _state = MutableStateFlow(PaywallUiState())
    val state: StateFlow<PaywallUiState> = _state.asStateFlow()

    fun subscribe() = perform { entitlementManager.purchase() }

    fun restore() = perform { entitlementManager.restore() }

    private fun perform(action: suspend () -> Unit) {
        viewModelScope.launch {
            _state.update { it.copy(isWorking = true, errorMessage = null) }
            try {
                action()
                _state.update { it.copy(isWorking = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isWorking = false, errorMessage = e.message) }
            }
        }
    }
}
