package com.athly.runner.feature.run.ui

import com.athly.runner.core.common.Formatters
import com.athly.runner.domain.model.SegmentEndBy
import com.athly.runner.domain.model.SegmentEndCondition
import java.util.Locale

/** Formatação da corrida — idêntica aos `formatted*` do iOS (RunTracker/CurrentSegmentBanner). */
object RunFormat {

    fun duration(seconds: Double): String = Formatters.duration(seconds)

    fun distanceKm(meters: Double): String = String.format(Locale.US, "%.2f", meters / 1000.0)

    /** "M:SS" (sem "/km"), ou "--:--" quando ≤0 / não-finito / ≥3600. */
    fun paceNoSuffix(secondsPerKm: Double): String = Formatters.paceNoSuffix(secondsPerKm)

    fun whole(value: Double): String = String.format(Locale.US, "%.0f", value)

    /** Resumo curto de uma condição de término — espelha `endSummary` do iOS. */
    fun endSummary(end: SegmentEndCondition): String = when (end.by) {
        SegmentEndBy.DISTANCE_M -> {
            val m = end.value.toInt()
            if (m >= 1000) String.format(Locale.US, "%.1f km", m / 1000.0) else "$m m"
        }
        SegmentEndBy.DURATION_SEC -> {
            val s = end.value.toInt()
            when {
                s >= 3600 -> String.format(Locale.US, "%dh%02d", s / 3600, (s % 3600) / 60)
                s >= 60 -> String.format(Locale.US, "%d:%02d", s / 60, s % 60)
                else -> "${s}s"
            }
        }
        SegmentEndBy.REPS -> "${end.value.toInt()} reps"
    }
}
