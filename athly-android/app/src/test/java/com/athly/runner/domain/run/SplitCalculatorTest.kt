package com.athly.runner.domain.run

import com.athly.runner.domain.model.EARTH_RADIUS_M
import com.athly.runner.domain.model.RoutePoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import java.time.Instant
import kotlin.math.PI
import org.junit.Test

/**
 * Valida o critério de aceite do prompt 07: o `SplitCalculator` espelha a lógica do iOS.
 * Os pontos ficam no equador (lat=0) e se movem só para leste — aí a distância Haversine é exatamente
 * a diferença em metros, então dá pra afirmar durações/distâncias exatas.
 */
class SplitCalculatorTest {

    private val base: Instant = Instant.parse("2026-07-09T10:00:00Z")
    private val metersPerDegLon = EARTH_RADIUS_M * PI / 180.0

    /** Ponto no equador a `eastMeters` de longitude 0, no instante `base + atMillis`. */
    private fun p(eastMeters: Double, atMillis: Long, altitude: Double = 0.0): RoutePoint =
        RoutePoint(
            latitude = 0.0,
            longitude = eastMeters / metersPerDegLon,
            altitude = altitude,
            timestamp = base.plusMillis(atMillis),
            speed = 0.0,
            horizontalAccuracy = 5.0,
        )

    private fun seconds(s: Long) = s * 1000L

    @Test
    fun `tempo parado inicial (antes de 20m) nao conta no km 1`() {
        // 20s parado no ponto 0, depois corre a 4 m/s. O relógio do km 1 só começa no 1o movimento (>=20m).
        val points = buildList {
            for (t in 0..280) {
                val east = if (t <= 20) 0.0 else (t - 20) * 4.0
                add(p(east, seconds(t.toLong())))
            }
        }
        val splits = SplitCalculator.kmSplits(points)

        assertEquals(1, splits.size)
        assertEquals(1, splits[0].kilometer)
        assertEquals(1000.0, splits[0].distanceMeters, 0.001)
        // 1000 m a 4 m/s = 250 s. Os ~25 s parados/aquecendo NÃO entram (senão seria ~275).
        assertEquals(250.0, splits[0].durationSeconds, 1.0)
        assertEquals(250.0, splits[0].paceSecondsPerKm, 1.0)
    }

    @Test
    fun `salto de GPS (velocidade implausivel) e ignorado`() {
        // Rota limpa a 4 m/s por 300 s (1200 m).
        val clean = buildList {
            for (t in 0..300) add(p(t * 4.0, seconds(t.toLong())))
        }
        // Mesma rota + um teleporte no meio (10 km em 0,5 s → ~18800 m/s, muito acima de 7).
        val spiked = buildList {
            addAll(clean)
            add(p(10_000.0, seconds(150) + 500)) // t = 150,5 s
        }

        val a = SplitCalculator.kmSplits(clean)
        val b = SplitCalculator.kmSplits(spiked)

        assertEquals(a.size, b.size)
        for (i in a.indices) {
            assertEquals(a[i].distanceMeters, b[i].distanceMeters, 0.01)
            assertEquals(a[i].durationSeconds, b[i].durationSeconds, 0.01)
        }
    }

    @Test
    fun `pausa explicita e excluida da duracao do split`() {
        // Corre 4 m/s até 400 m (t=100), fica parado até t=160, depois corre de novo.
        val points = buildList {
            for (t in 0..100) add(p(t * 4.0, seconds(t.toLong())))
            for (t in 101..160) add(p(400.0, seconds(t.toLong())))
            for (t in 161..320) add(p(400.0 + (t - 160) * 4.0, seconds(t.toLong())))
        }
        val pause = listOf(PauseInterval(base.plusSeconds(100), base.plusSeconds(160)))

        val withPause = SplitCalculator.kmSplits(points, pause)
        val withoutPause = SplitCalculator.kmSplits(points)

        // Com a pausa declarada, os 60 s parados não contam: 1000 m a 4 m/s = 250 s.
        assertTrue(withPause.isNotEmpty())
        assertEquals(250.0, withPause[0].durationSeconds, 1.5)
        // Sem declarar a pausa, os 60 s parados (intervalo de 1 s cada) entram: ~310 s.
        assertEquals(310.0, withoutPause[0].durationSeconds, 1.5)
    }

    @Test
    fun `km parcial final so conta com pelo menos 50m`() {
        // 6 m/s: distâncias 0,6,12,18,24,... → a âncora de 20 m cai claramente entre 18 e 24 (t=4).
        fun route(lastT: Int) = buildList { for (t in 0..lastT) add(p(t * 6.0, seconds(t.toLong()))) }

        // último = 1044 m → runDistance ~1020 → 1 km cheio + ~20 m (descartado, < 50).
        val short = SplitCalculator.kmSplits(route(174))
        assertEquals(1, short.size)

        // último = 1092 m → runDistance ~1068 → 1 km cheio + ~68 m (conta, >= 50).
        val long = SplitCalculator.kmSplits(route(182))
        assertEquals(2, long.size)
        assertEquals(68.0, long[1].distanceMeters, 2.0)
        // pace do parcial = dur / (dist/1000).
        assertEquals(long[1].durationSeconds / (long[1].distanceMeters / 1000.0), long[1].paceSecondsPerKm, 0.001)
    }

    @Test
    fun `sem dados suficientes retorna vazio`() {
        assertTrue(SplitCalculator.kmSplits(emptyList()).isEmpty())
        // Menos de 50 m percorridos → sem splits.
        val tiny = buildList { for (t in 0..5) add(p(t * 4.0, seconds(t.toLong()))) }
        assertTrue(SplitCalculator.kmSplits(tiny).isEmpty())
    }
}
