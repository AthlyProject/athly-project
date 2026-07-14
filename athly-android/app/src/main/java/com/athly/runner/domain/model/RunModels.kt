package com.athly.runner.domain.model

import com.athly.runner.core.common.Formatters
import java.time.Instant
import java.util.Locale
import java.util.UUID

/*
 * Modelos de domínio da corrida — espelham RunSession.swift / RoutePoint.swift / Split.swift.
 * Imutáveis (data class); o tracker (prompt 07) evolui o estado via `copy()`.
 * Datas como `java.time.Instant` (o equivalente ao `Date` do iOS).
 */

/** Um ponto do trajeto. Espelha `RoutePoint` do iOS; a conversão de `Location` vem no prompt 06. */
data class RoutePoint(
    val id: String = UUID.randomUUID().toString(),
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val timestamp: Instant,
    val speed: Double,
    val horizontalAccuracy: Double,
)

/** Um split de 1 km (ou parcial final). Espelha `Split` do iOS. */
data class Split(
    val id: String = UUID.randomUUID().toString(),
    val kilometer: Int,
    val durationSeconds: Double,
    val distanceMeters: Double,
    val paceSecondsPerKm: Double,
    val elevationDelta: Double,
) {
    /** "M:SS /km" — espelha `Split.formattedPace` do iOS. */
    val formattedPace: String
        get() {
            val total = paceSecondsPerKm.toInt()
            return String.format(Locale.US, "%d:%02d /km", total / 60, total % 60)
        }

    companion object {
        /** Deriva o pace da distância real do segmento — espelha o `init` do iOS (km parcial final correto). */
        fun of(
            kilometer: Int,
            durationSeconds: Double,
            distanceMeters: Double = 1000.0,
            elevationDelta: Double = 0.0,
        ): Split {
            val pace = if (distanceMeters > 0) durationSeconds / (distanceMeters / 1000.0) else 0.0
            return Split(
                kilometer = kilometer,
                durationSeconds = durationSeconds,
                distanceMeters = distanceMeters,
                paceSecondsPerKm = pace,
                elevationDelta = elevationDelta,
            )
        }
    }
}

/**
 * Saída do `SplitCalculator` (prompt 07) — split com janelas de tempo explícitas.
 * Mais rico que `Split` (guarda início/fim para releitura offline).
 */
data class KmSplit(
    val kilometer: Int,
    val startDate: Instant,
    val endDate: Instant,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val elevationDelta: Double,
    val paceSecondsPerKm: Double,
)

/**
 * Sessão de corrida (ao vivo e persistida). Espelha `RunSession` do iOS.
 * `status`: active | paused | completed. `sportType`: running | walking | trail (strings livres, como o iOS).
 */
data class RunSession(
    val id: String = UUID.randomUUID().toString(),
    val startDate: Instant,
    val endDate: Instant? = null,
    val distanceMeters: Double = 0.0,
    val durationSeconds: Double = 0.0,
    val averagePaceSecondsPerKm: Double = 0.0,
    val elevationGainMeters: Double = 0.0,
    val caloriesBurned: Double = 0.0,
    val status: String = "active",
    val sportType: String = "running",
    val routePoints: List<RoutePoint> = emptyList(),
    val splits: List<Split> = emptyList(),
    // Sync com o backend
    val backendId: String? = null,
    val synced: Boolean = false,
) {
    val distanceKm: Double get() = distanceMeters / 1000.0

    /** "%.2f" sem sufixo — espelha `RunSession.formattedDistance` do iOS. */
    val formattedDistance: String get() = String.format(Locale.US, "%.2f", distanceKm)

    /** "H:MM:SS" (com horas) ou "MM:SS" — espelha `RunSession.formattedDuration` do iOS. */
    val formattedDuration: String get() = Formatters.duration(durationSeconds)

    /** "M:SS" (sem "/km") ou "--:--" — espelha `RunSession.formattedPace` do iOS. */
    val formattedPace: String
        get() {
            if (averagePaceSecondsPerKm <= 0 || !averagePaceSecondsPerKm.isFinite()) return "--:--"
            val total = averagePaceSecondsPerKm.toInt()
            return String.format(Locale.US, "%d:%02d", total / 60, total % 60)
        }
}
