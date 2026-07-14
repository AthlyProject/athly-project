package com.athly.runner.domain.run

import com.athly.runner.domain.model.KmSplit
import com.athly.runner.domain.model.RoutePoint
import com.athly.runner.domain.model.distanceTo
import java.time.Instant

/**
 * Algoritmo ÚNICO de splits por km — porta exata de `SplitCalculator.swift`. Compartilhado entre o
 * tracker ao vivo ([RunTracker]) e a leitura de rota do Health Connect (prompt 12): centralizar evita
 * que os dois caminhos divirjam. Opera sobre [RoutePoint] (domínio, puro → testável) usando a MESMA
 * distância Haversine do tracker.
 *
 * Regras: salto de GPS rejeitado por plausibilidade de velocidade (≤ 7 m/s); tempo parado/buraco de GPS
 * (pausa, tela bloqueada) excluído da duração; o relógio do km 1 só começa no primeiro movimento real
 * (âncora ≥ 20 m); fronteiras de km por interpolação linear; km parcial final só com ≥ 50 m.
 */
object SplitCalculator {

    /** Velocidade máxima plausível em corrida (m/s ≈ 2:23/km). Acima disso é salto de GPS. */
    const val MAX_PLAUSIBLE_SPEED = 7.0
    /** Gap (s) entre fixes acima do qual o intervalo é candidato a pausa/blackout de GPS. */
    const val GAP_CAP_SECONDS = 6.0
    /** Velocidade (m/s) abaixo da qual um gap grande é tratado como parado (não conta tempo). */
    const val STATIONARY_SPEED = 0.5
    /** Distância (m) do "primeiro movimento": o relógio do km 1 só começa aqui. */
    const val START_MOVEMENT_METERS = 20.0
    /** Distância mínima (m) para registrar um km parcial final. */
    const val MIN_TRAILING_METERS = 50.0
    /** Gap máximo (s) que ainda recebe crédito de distância pela velocidade pré-gap. */
    const val MAX_BRIDGE_GAP_SECONDS = 90.0
    /** Janela (s de tempo em movimento) usada para estimar a velocidade pré-gap. */
    const val SPEED_LOOKBACK_SECONDS = 30.0

    private data class Sample(
        val date: Instant,
        val movingTime: Double,
        val distance: Double,
        val altitude: Double,
    )

    /** Quebra os pontos em splits de 1 km. Retorna `[]` sem dados suficientes. */
    fun kmSplits(locations: List<RoutePoint>, pauses: List<PauseInterval> = emptyList()): List<KmSplit> {
        val samples = normalize(locations, pauses)
        if (samples.size < 2) return emptyList()

        val anchor = samples.firstOrNull { it.distance >= START_MOVEMENT_METERS } ?: samples[0]
        val runDistance = samples.last().distance - anchor.distance
        if (runDistance < MIN_TRAILING_METERS) return emptyList()

        val splits = mutableListOf<KmSplit>()
        var prev = anchor
        val fullKms = (runDistance / 1000.0).toInt()

        var km = 1
        while (km <= fullKms) {
            val boundary = anchor.distance + km * 1000.0
            val at = interpolate(samples, boundary)
            splits.add(
                kmSplit(
                    kilometer = km,
                    start = prev.date,
                    end = at.date,
                    distanceMeters = 1000.0,
                    durationSeconds = maxOf(0.0, at.movingTime - prev.movingTime),
                    elevationDelta = at.altitude - prev.altitude,
                ),
            )
            prev = at
            km += 1
        }

        val leftover = runDistance - fullKms * 1000.0
        if (leftover >= MIN_TRAILING_METERS) {
            val last = samples.last()
            splits.add(
                kmSplit(
                    kilometer = fullKms + 1,
                    start = prev.date,
                    end = last.date,
                    distanceMeters = leftover,
                    durationSeconds = maxOf(0.0, last.movingTime - prev.movingTime),
                    elevationDelta = last.altitude - prev.altitude,
                ),
            )
        }

        return splits
    }

    /**
     * Distância real percorrida em cada faixa de tempo (mesmo filtro de salto/pausa) — usada para dar
     * pace real aos laps de treino (prompt 12). Retorna `null` sem amostras suficientes.
     */
    fun distances(
        ranges: List<Pair<Instant, Instant>>,
        locations: List<RoutePoint>,
        pauses: List<PauseInterval> = emptyList(),
    ): List<Double>? {
        val samples = normalize(locations, pauses)
        if (samples.size < 2) return null
        return ranges.map { (start, end) ->
            maxOf(0.0, distanceAt(end, samples) - distanceAt(start, samples))
        }
    }

    private fun kmSplit(
        kilometer: Int,
        start: Instant,
        end: Instant,
        distanceMeters: Double,
        durationSeconds: Double,
        elevationDelta: Double,
    ): KmSplit = KmSplit(
        kilometer = kilometer,
        startDate = start,
        endDate = end,
        distanceMeters = distanceMeters,
        durationSeconds = durationSeconds,
        elevationDelta = elevationDelta,
        paceSecondsPerKm = if (distanceMeters > 0) durationSeconds / (distanceMeters / 1000.0) else 0.0,
    )

    private fun normalize(locations: List<RoutePoint>, pauses: List<PauseInterval>): List<Sample> {
        val sorted = locations.sortedBy { it.timestamp }
        val first = sorted.firstOrNull() ?: return emptyList()

        val samples = mutableListOf(Sample(first.timestamp, 0.0, 0.0, first.altitude))
        var lastGood = first
        var cumDistance = 0.0
        var cumTime = 0.0

        for (i in 1 until sorted.size) {
            val loc = sorted[i]
            val delta = loc.distanceTo(lastGood)
            val dt = seconds(lastGood.timestamp, loc.timestamp)
            if (dt <= 0) continue

            // Salto de GPS: velocidade implausível → ignora SEM avançar `lastGood`.
            val impliedSpeed = delta / dt
            if (impliedSpeed > MAX_PLAUSIBLE_SPEED) continue

            val crossesPause = pauses.any { it.start < loc.timestamp && it.end > lastGood.timestamp }

            val timeStep = when {
                crossesPause -> 0.0
                dt > GAP_CAP_SECONDS && impliedSpeed < STATIONARY_SPEED -> 0.0
                else -> dt
            }

            var distStep = if (crossesPause) 0.0 else delta
            if (!crossesPause &&
                dt > GAP_CAP_SECONDS &&
                dt <= MAX_BRIDGE_GAP_SECONDS &&
                impliedSpeed >= STATIONARY_SPEED
            ) {
                recentSpeed(samples)?.let { speedBefore ->
                    distStep = minOf(maxOf(delta, speedBefore * dt), MAX_PLAUSIBLE_SPEED * dt)
                }
            }

            cumDistance += distStep
            cumTime += timeStep
            samples.add(Sample(loc.timestamp, cumTime, cumDistance, loc.altitude))
            lastGood = loc
        }

        return samples
    }

    private fun recentSpeed(samples: List<Sample>): Double? {
        val last = samples.lastOrNull() ?: return null
        val anchor = samples.lastOrNull { last.movingTime - it.movingTime >= SPEED_LOOKBACK_SECONDS }
            ?: samples.firstOrNull() ?: return null
        val timeSpan = last.movingTime - anchor.movingTime
        if (timeSpan < 5) return null
        val speed = (last.distance - anchor.distance) / timeSpan
        if (speed < STATIONARY_SPEED || speed > MAX_PLAUSIBLE_SPEED) return null
        return speed
    }

    private fun interpolate(samples: List<Sample>, distance: Double): Sample {
        if (distance <= samples.first().distance) return samples.first()
        if (distance >= samples.last().distance) return samples.last()

        for (i in 1 until samples.size) {
            val a = samples[i - 1]
            val b = samples[i]
            if (b.distance >= distance) {
                val span = b.distance - a.distance
                if (span <= 0) return b
                val f = (distance - a.distance) / span
                return Sample(
                    date = lerpInstant(a.date, b.date, f),
                    movingTime = a.movingTime + (b.movingTime - a.movingTime) * f,
                    distance = distance,
                    altitude = a.altitude + (b.altitude - a.altitude) * f,
                )
            }
        }
        return samples.last()
    }

    private fun distanceAt(date: Instant, samples: List<Sample>): Double {
        val first = samples.first()
        val last = samples.last()
        if (date <= first.date) return first.distance
        if (date >= last.date) return last.distance
        for (i in 1 until samples.size) {
            val a = samples[i - 1]
            val b = samples[i]
            if (b.date >= date) {
                val span = seconds(a.date, b.date)
                if (span <= 0) return b.distance
                val f = seconds(a.date, date) / span
                return a.distance + (b.distance - a.distance) * f
            }
        }
        return last.distance
    }

    private fun seconds(from: Instant, to: Instant): Double =
        (to.toEpochMilli() - from.toEpochMilli()) / 1000.0

    private fun lerpInstant(a: Instant, b: Instant, f: Double): Instant =
        Instant.ofEpochMilli((a.toEpochMilli() + (b.toEpochMilli() - a.toEpochMilli()) * f).toLong())
}
