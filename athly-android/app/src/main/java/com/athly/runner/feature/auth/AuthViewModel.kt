package com.athly.runner.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.data.TokenStore
import com.athly.runner.core.data.UserPreferences
import com.athly.runner.core.network.SessionEvents
import com.athly.runner.data.repository.AuthRepository
import com.athly.runner.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Estado da sessão/auth exposto à UI — espelha os `@Published` do `AuthViewModel` iOS. */
data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val userName: String = "",
    val hasFinishedInitialSessionRestore: Boolean = false,
)

/**
 * Espelha o `AuthViewModel` do iOS. Restaura a sessão no cold start (TokenStore), faz login/registro,
 * logout e exclusão de conta, e **observa** o evento global de "sessão expirada" (SessionEvents, prompt 02)
 * para deslogar — sem duplicar a lógica de refresh, que vive no TokenAuthenticator.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
    private val tokenStore: TokenStore,
    private val sessionEvents: SessionEvents,
    private val userPreferences: UserPreferences,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    init {
        restoreSession()
        observeSessionExpiry()
    }

    /**
     * Cold start: se houver tokens salvos → autenticado. Em QUALQUER caso marca
     * `hasFinishedInitialSessionRestore=true` (o gate do splash depende disso).
     */
    private fun restoreSession() {
        val access = tokenStore.accessToken()
        val refresh = tokenStore.refreshToken()
        if (access != null && refresh != null) {
            _state.update { it.copy(isAuthenticated = true, hasFinishedInitialSessionRestore = true) }
            viewModelScope.launch { refreshUserName() }
        } else {
            _state.update { it.copy(hasFinishedInitialSessionRestore = true) }
        }
    }

    /** 401 irrecuperável (refresh falhou) → desloga e volta ao login. Guard idempotente. */
    private fun observeSessionExpiry() {
        viewModelScope.launch {
            sessionEvents.events.collect { event ->
                if (event is SessionEvents.Event.SessionExpired && _state.value.isAuthenticated) {
                    authRepository.logout()
                    _state.update {
                        it.copy(
                            isAuthenticated = false,
                            userName = "",
                            errorMessage = "Sua sessão expirou. Faça login novamente.",
                        )
                    }
                }
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = authRepository.login(email.trim(), password)) {
                is AthlyResult.Success -> {
                    _state.update { it.copy(isAuthenticated = true, isLoading = false) }
                    refreshUserName()
                }
                is AthlyResult.Failure -> _state.update {
                    it.copy(isLoading = false, errorMessage = result.errorText())
                }
            }
        }
    }

    fun register(
        email: String,
        userName: String,
        name: String,
        password: String,
        confirmPassword: String,
        dateOfBirth: String,
        weight: Double,
        height: Double,
    ) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            val result = authRepository.register(
                email = email.trim(),
                userName = userName.trim(),
                name = name.trim(),
                password = password,
                confirmPassword = confirmPassword,
                dateOfBirth = dateOfBirth,
                weight = weight,
                height = height,
            )
            when (result) {
                is AthlyResult.Success -> {
                    userPreferences.setWeightKg(weight)
                    userPreferences.setUserName(userName.trim())
                    _state.update {
                        it.copy(isAuthenticated = true, isLoading = false, userName = userName.trim())
                    }
                }
                is AthlyResult.Failure -> _state.update {
                    it.copy(isLoading = false, errorMessage = result.errorText())
                }
            }
        }
    }

    fun logout() {
        authRepository.logout()
        _state.update { it.copy(isAuthenticated = false, userName = "") }
    }

    /** Exclui a conta no servidor (cascade) e limpa a sessão local. */
    fun deleteAccount() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, errorMessage = null) }
            when (val result = userRepository.deleteAccount()) {
                is AthlyResult.Success -> {
                    authRepository.logout()
                    _state.update {
                        it.copy(isAuthenticated = false, userName = "", isLoading = false)
                    }
                }
                is AthlyResult.Failure -> _state.update {
                    it.copy(isLoading = false, errorMessage = result.errorText())
                }
            }
        }
    }

    fun clearError() {
        _state.update { it.copy(errorMessage = null) }
    }

    /**
     * Carrega o username do perfil (`GET /users/me`) para a saudação; usa `name` como fallback.
     * Falha silenciosa (a saudação cai em vazio → "Atleta" na UI).
     */
    private suspend fun refreshUserName() {
        when (val result = userRepository.getProfile()) {
            is AthlyResult.Success -> {
                val resolved = result.data.username ?: result.data.name ?: ""
                _state.update { it.copy(userName = resolved) }
                if (resolved.isNotEmpty()) userPreferences.setUserName(resolved)
            }
            is AthlyResult.Failure -> Unit
        }
    }

    private fun AthlyResult.Failure.errorText(): String =
        message ?: error.message ?: "Algo deu errado. Tente novamente."
}
