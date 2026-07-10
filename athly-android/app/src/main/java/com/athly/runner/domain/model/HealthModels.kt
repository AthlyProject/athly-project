package com.athly.runner.domain.model

import com.athly.runner.core.common.Formatters
import java.time.Instant
import java.util.Locale

/*
 * Modelos de domínio ligados ao Health Connect (prompt 12) — espelham HealthKitRunItem.swift /
 * RunWorkoutLink.swift. Só leitura/apresentação; a integração real vem no prompt 12.
 */

/** Corrida lida do Health Connect (somente leitura). Espelha `HealthKitRunItem` do iOS. */
data class HealthRunItem(
    val id: String,
    val startDate: Instant,
    val endDate: Instant,
    val durationSeconds: Double,
    val distanceMeters: Double,
    val averagePaceSecondsPerKm: Double,
    val activeEnergyBurned: Double,
    val elevationGainMeters: Double? = null,
) {
    val distanceKm: Double get() = distanceMeters / 1000.0

    /** "%.2f" sem sufixo — espelha `HealthKitRunItem.formattedDistance` do iOS. */
    val formattedDistance: String get() = String.format(Locale.US, "%.2f", distanceKm)

    val formattedDuration: String get() = Formatters.duration(durationSeconds)

    /** "M:SS" (sem "/km") ou "--:--" — espelha `HealthKitRunItem.formattedPace` do iOS. */
    val formattedPace: String
        get() {
            if (averagePaceSecondsPerKm <= 0 || !averagePaceSecondsPerKm.isFinite()) return "--:--"
            val total = averagePaceSecondsPerKm.toInt()
            return String.format(Locale.US, "%d:%02d", total / 60, total % 60)
        }
}

/**
 * Vínculo local entre um registro do Health Connect e um treino prescrito.
 * Espelha `RunWorkoutLink` do iOS (`healthKitUUID` → `healthConnectId` no Android).
 */
data class RunWorkoutLink(
    val healthConnectId: String,
    val athlyWorkoutId: String,
    val linkedAt: Instant,
)
