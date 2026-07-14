package com.athly.runner.core.location

import android.location.Location
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Barramento singleton de localização — o [RunLocationService] (dono do request) publica aqui e o
 * `RunTracker` (prompt 07) consome. Desacopla o consumidor do ciclo de vida do serviço.
 * `locations` = todos os pontos (como o `PassthroughSubject` do iOS); `currentLocation` = último ponto.
 */
@Singleton
class LocationRepository @Inject constructor() {

    private val _locations = MutableSharedFlow<Location>(replay = 0, extraBufferCapacity = 64)
    val locations: SharedFlow<Location> = _locations.asSharedFlow()

    private val _currentLocation = MutableStateFlow<Location?>(null)
    val currentLocation: StateFlow<Location?> = _currentLocation.asStateFlow()

    fun publish(location: Location) {
        _currentLocation.value = location
        _locations.tryEmit(location)
    }
}
