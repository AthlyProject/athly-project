package com.athly.runner.core.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Fonte de localização de alta precisão — espelha o `CLLocationManager` do iOS
 * (`bestForNavigation`, `distanceFilter=5`, sem auto-pause). Expõe um `Flow<Location>` que emite
 * **cada** ponto aceito de cada lote (não coalesce), ordenado por tempo — igual ao `didUpdateLocations`
 * do iOS, que pode entregar vários pontos de uma vez ao desbloquear a tela.
 */
@Singleton
class LocationDataSource @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val client: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)

    /**
     * callbackFlow com `requestLocationUpdates`. Em cada `LocationResult`, filtra precisão em `[0, 50)m`,
     * ordena por `time` e emite **todos** os pontos (não só `.last`). O corte é 50m (não 30) espelhando o
     * iOS: descartar pontos inteiros cria buracos que viram distância em linha reta; o filtro de velocidade
     * implausível no consumidor (07) segura os teleportes.
     */
    @SuppressLint("MissingPermission")
    fun locationFlow(): Flow<Location> = callbackFlow {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_DISTANCE_M)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations
                    .filter { it.hasAccuracy() && it.accuracy >= 0f && it.accuracy < MAX_ACCURACY_M }
                    .sortedBy { it.time }
                    .forEach { trySend(it) }
            }
        }

        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        awaitClose { client.removeLocationUpdates(callback) }
    }

    private companion object {
        const val INTERVAL_MS = 1000L
        const val MIN_DISTANCE_M = 5f
        const val MAX_ACCURACY_M = 50f
    }
}
