package com.athly.runner.domain.run

/**
 * Ganho de elevação filtrado — porta exata de `ElevationAccumulator.swift`. Três camadas:
 * (1) gate de `verticalAccuracy` (descarta o lixo do aquecimento do GPS, incl. vAcc ≤ 0 = inválida);
 * (2) suavização EMA da altitude; (3) deadband/histerese (credita ganho só quando a altitude suavizada
 * sobe `gainThreshold` acima do vale corrente; acompanha o vale na descida).
 */
class ElevationAccumulator(
    private val maxVerticalAccuracy: Double = 8.0,
    private val smoothingAlpha: Double = 0.3,
    private val gainThreshold: Double = 2.0,
) {
    var gain: Double = 0.0
        private set

    private var smoothed: Double? = null
    private var reference: Double? = null

    val smoothedAltitude: Double? get() = smoothed

    fun add(altitude: Double, verticalAccuracy: Double) {
        if (verticalAccuracy <= 0 || verticalAccuracy > maxVerticalAccuracy) return

        val s = smoothed?.let { it + smoothingAlpha * (altitude - it) } ?: altitude
        smoothed = s

        val ref = reference
        if (ref == null) {
            reference = s
            return
        }
        if (s - ref >= gainThreshold) {
            gain += s - ref
            reference = s
        } else if (s < ref) {
            reference = s
        }
    }

    fun reset() {
        gain = 0.0
        smoothed = null
        reference = null
    }
}
