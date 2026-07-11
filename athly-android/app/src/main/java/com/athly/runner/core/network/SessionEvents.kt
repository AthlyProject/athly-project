package com.athly.runner.core.network

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Espelha as Notification.Name do APIClient iOS:
 * - [Event.SessionExpired] = `athlySessionExpired` (401 e o refresh falhou) — o AuthViewModel
 *   (prompt 04) observa para deslogar e voltar ao login.
 * - [Event.TokensRefreshed] = `athlyTokensRefreshed` (tokens renovados com sucesso).
 */
@Singleton
class SessionEvents @Inject constructor() {

    private val _events = MutableSharedFlow<Event>(extraBufferCapacity = 8)
    val events: SharedFlow<Event> = _events.asSharedFlow()

    fun notifySessionExpired() {
        _events.tryEmit(Event.SessionExpired)
    }

    fun notifyTokensRefreshed() {
        _events.tryEmit(Event.TokensRefreshed)
    }

    sealed interface Event {
        data object SessionExpired : Event
        data object TokensRefreshed : Event
    }
}
