package com.athly.runner.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.data.RunStore
import com.athly.runner.core.data.TrainingPlanCache
import com.athly.runner.core.data.UserPreferences
import com.athly.runner.core.notifications.WorkoutReminderScheduler
import com.athly.runner.data.remote.dto.UpdateProfileRequest
import com.athly.runner.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Estatísticas gerais agregadas do histórico local — espelha a seção do `ProfileView` iOS. */
data class ProfileStats(
    val totalRuns: Int = 0,
    val totalDistanceKm: Double = 0.0,
    val totalDurationSec: Double = 0.0,
    val avgPaceSecPerKm: Double = 0.0,
    val totalElevationM: Double = 0.0,
)

data class ProfileUiState(
    val stats: ProfileStats = ProfileStats(),
    val selectedDays: Set<String> = emptySet(),
    val isSavingDays: Boolean = false,
    val showSaveConfirmation: Boolean = false,
    val saveError: String? = null,
    val remindersEnabled: Boolean = true,
    val weightText: String = "",
    val isSavingWeight: Boolean = false,
    val weightError: String? = null,
    val weightSaved: Boolean = false,
)

/**
 * Perfil — espelha `ProfileView` do iOS: stats do histórico, dias disponíveis, lembretes (21),
 * peso (persiste também no UserPreferences p/ calorias do tracker). Sair/excluir são do
 * AuthViewModel (04), acionados pela tela. Admin (email-gated) não portado nesta fatia.
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val userPreferences: UserPreferences,
    private val reminderScheduler: WorkoutReminderScheduler,
    private val planCache: TrainingPlanCache,
    runStore: RunStore,
) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init {
        // Stats reativas do histórico local (Room).
        viewModelScope.launch {
            runStore.sessions.collect { sessions ->
                val totalDistanceKm = sessions.sumOf { it.distanceMeters / 1000.0 }
                val totalDuration = sessions.sumOf { it.durationSeconds }
                _state.update {
                    it.copy(
                        stats = ProfileStats(
                            totalRuns = sessions.size,
                            totalDistanceKm = totalDistanceKm,
                            totalDurationSec = totalDuration,
                            avgPaceSecPerKm = if (totalDistanceKm > 0) totalDuration / totalDistanceKm else 0.0,
                            totalElevationM = sessions.sumOf { s -> s.elevationGainMeters },
                        ),
                    )
                }
            }
        }
        viewModelScope.launch {
            reminderScheduler.isEnabled.collect { enabled ->
                _state.update { it.copy(remindersEnabled = enabled) }
            }
        }
        loadProfile()
    }

    private fun loadProfile() {
        viewModelScope.launch {
            when (val result = userRepository.getProfile()) {
                is AthlyResult.Success -> _state.update {
                    it.copy(
                        selectedDays = result.data.availableDays.orEmpty().toSet(),
                        weightText = result.data.weight?.toString().orEmpty(),
                    )
                }

                is AthlyResult.Failure -> Unit // sem rede → mantém os campos vazios
            }
        }
    }

    fun toggleDay(key: String) {
        _state.update {
            val days = it.selectedDays.toMutableSet()
            if (!days.add(key)) days.remove(key)
            it.copy(selectedDays = days)
        }
    }

    /** Envia a lista completa atual (não diff) + confirmação por 2s — espelha o iOS. */
    fun saveDays() {
        viewModelScope.launch {
            _state.update { it.copy(isSavingDays = true, saveError = null) }
            val result = userRepository.updateProfile(
                UpdateProfileRequest(availableDays = _state.value.selectedDays.toList()),
            )
            when (result) {
                is AthlyResult.Success -> {
                    _state.update { it.copy(isSavingDays = false, showSaveConfirmation = true) }
                    delay(2000)
                    _state.update { it.copy(showSaveConfirmation = false) }
                }

                is AthlyResult.Failure -> _state.update {
                    it.copy(isSavingDays = false, saveError = "Não foi possível salvar. Tente novamente.")
                }
            }
        }
    }

    fun onWeightTextChange(text: String) {
        _state.update { it.copy(weightText = text, weightError = null, weightSaved = false) }
    }

    /** Valida 0 < kg < 400 (aceita vírgula) — espelha o iOS. Persiste também localmente (calorias). */
    fun saveWeight() {
        val kg = _state.value.weightText.replace(',', '.').toDoubleOrNull()
        if (kg == null || kg <= 0 || kg >= 400) {
            _state.update { it.copy(weightError = "Peso inválido. Use um valor entre 1 e 399 kg.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isSavingWeight = true, weightError = null) }
            when (val result = userRepository.updateProfile(UpdateProfileRequest(weight = kg))) {
                is AthlyResult.Success -> {
                    userPreferences.setWeightKg(result.data.weight ?: kg)
                    _state.update {
                        it.copy(
                            isSavingWeight = false,
                            weightSaved = true,
                            weightText = (result.data.weight ?: kg).toString(),
                        )
                    }
                }

                is AthlyResult.Failure -> _state.update {
                    it.copy(isSavingWeight = false, weightError = "Não foi possível salvar o peso.")
                }
            }
        }
    }

    /** Toggle de lembretes — reagenda/cancela com os workouts do cache do plano (14/21). */
    fun setRemindersEnabled(enabled: Boolean) {
        viewModelScope.launch {
            val workouts = planCache.load()?.allWorkouts.orEmpty()
            reminderScheduler.setEnabled(enabled, workouts)
        }
    }
}
