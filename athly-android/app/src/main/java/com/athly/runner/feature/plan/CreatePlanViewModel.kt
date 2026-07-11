package com.athly.runner.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.network.ApiError
import com.athly.runner.core.network.AthlyJson
import com.athly.runner.data.remote.dto.ParsedGoalDto
import com.athly.runner.data.repository.GoalRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import javax.inject.Inject

/** Estado da tela Novo Plano — espelha os `@State` do `CreatePlanView` iOS. */
data class CreatePlanUiState(
    val goalText: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val parsedGoal: ParsedGoalDto? = null,
    val showConfirmation: Boolean = false,
)

/**
 * Interpreta o objetivo em texto livre (`POST /goals`) e abre a confirmação — espelha `submitGoal()`
 * do iOS, incluindo o tratamento do 422 (objetivo não-corrida). A geração da primeira semana é
 * delegada ao `TrainingPlanViewModel` (14), que já tem o fluxo plan-from-health + polling.
 */
@HiltViewModel
class CreatePlanViewModel @Inject constructor(
    private val goalRepository: GoalRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(CreatePlanUiState())
    val state: StateFlow<CreatePlanUiState> = _state.asStateFlow()

    private val json = AthlyJson.create()

    /** Trunca em 500 no input (não só no contador). */
    fun onGoalTextChange(text: String) {
        _state.update { it.copy(goalText = text.take(MAX_LENGTH)) }
    }

    fun submitGoal() {
        val text = _state.value.goalText
        if (text.length < MIN_LENGTH) return
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, errorMessage = null) }
            when (val result = goalRepository.createGoal(text)) {
                is AthlyResult.Success -> _state.update {
                    it.copy(isSubmitting = false, parsedGoal = result.data.parsedGoal, showConfirmation = true)
                }

                is AthlyResult.Failure -> _state.update {
                    it.copy(isSubmitting = false, errorMessage = errorMessage(result.error))
                }
            }
        }
    }

    fun reset() {
        _state.value = CreatePlanUiState()
    }

    private fun errorMessage(error: Throwable): String = when (error) {
        is ApiError.Server -> {
            if (error.code == 422) {
                extractMessage(error.body)
                    ?: "Objetivo não reconhecido como corrida. Tente descrever uma meta relacionada a correr."
            } else {
                "Erro ao processar objetivo. Tente novamente."
            }
        }

        is ApiError.Network -> "Erro de conexão. Verifique sua internet e tente novamente."
        else -> "Erro ao processar objetivo. Tente novamente."
    }

    private fun extractMessage(body: String): String? = runCatching {
        (json.parseToJsonElement(body) as? JsonObject)?.get("message")?.jsonPrimitive?.content
    }.getOrNull()

    companion object {
        const val MAX_LENGTH = 500
        const val MIN_LENGTH = 10
    }
}
