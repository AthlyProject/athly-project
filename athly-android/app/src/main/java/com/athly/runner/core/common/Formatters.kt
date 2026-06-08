package com.athly.runner.core.common

import java.util.Locale
import kotlin.math.roundToInt

/**
 * Formatadores espelhando os `formatted*` do iOS (RunSession.swift / Split.swift / views).
 * Mantidos aqui no core para reuso por todas as features.
 */
object Formatters {

    /** Pace em segundos/km → "M:SS /km" (ou "--:--" quando inválido). Espelha formatPace do iOS. */
    fun pace(secondsPerKm: Double): String {
        if (secondsPerKm <= 0 || !secondsPerKm.isFinite() || secondsPerKm >= 3600) return "--:--"
        val total = secondsPerKm.roundToInt()
        return String.format(Locale.US, "%d:%02d /km", total / 60, total % 60)
    }

    /** Metros → "X.XX km". */
    fun distanceKm(meters: Double): String =
        String.format(Locale.US, "%.2f km", meters / 1000.0)

    /** Segundos → "H:MM:SS" (com horas) ou "MM:SS". */
    fun duration(seconds: Double): String {
        val s = seconds.toInt().coerceAtLeast(0)
        val h = s / 3600
        val m = (s % 3600) / 60
        val sec = s % 60
        return if (h > 0) {
            String.format(Locale.US, "%d:%02d:%02d", h, m, sec)
        } else {
            String.format(Locale.US, "%02d:%02d", m, sec)
        }
    }
}
