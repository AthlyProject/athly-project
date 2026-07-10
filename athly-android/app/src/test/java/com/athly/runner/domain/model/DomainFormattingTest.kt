package com.athly.runner.domain.model

import org.junit.Assert.assertEquals
import java.time.Instant
import org.junit.Test

/**
 * Critério de aceite do prompt 03: `formattedPace`/`formattedDistance`/`formattedDuration`
 * batem com os `formatted*` do iOS (RunSession.swift / Split.swift / HealthKitRunItem.swift).
 */
class DomainFormattingTest {

    private val t0 = Instant.parse("2026-07-09T10:00:00Z")

    @Test
    fun `RunSession formata distancia, duracao e pace como o iOS`() {
        val run = RunSession(
            startDate = t0,
            distanceMeters = 5230.0,
            durationSeconds = 1530.0, // 25:30
            averagePaceSecondsPerKm = 292.6, // 4:52
        )
        assertEquals("5.23", run.formattedDistance) // %.2f sem sufixo
        assertEquals("25:30", run.formattedDuration) // < 1h → MM:SS
        assertEquals("4:52", run.formattedPace) // M:SS sem "/km"
    }

    @Test
    fun `RunSession com mais de uma hora usa H-MM-SS e pace invalido vira travessao`() {
        val run = RunSession(
            startDate = t0,
            durationSeconds = 3661.0, // 1:01:01
            averagePaceSecondsPerKm = 0.0,
        )
        assertEquals("1:01:01", run.formattedDuration)
        assertEquals("--:--", run.formattedPace)
    }

    @Test
    fun `Split deriva pace da distancia real e formata com sufixo -km`() {
        // 800 m em 200 s → 250 s/km = 4:10 /km.
        val split = Split.of(kilometer = 1, durationSeconds = 200.0, distanceMeters = 800.0)
        assertEquals(250.0, split.paceSecondsPerKm, 0.0001)
        assertEquals("4:10 /km", split.formattedPace)
    }

    @Test
    fun `HealthRunItem formata como o iOS`() {
        val item = HealthRunItem(
            id = "hc1",
            startDate = t0,
            endDate = t0.plusSeconds(1800),
            durationSeconds = 1800.0,
            distanceMeters = 10000.0,
            averagePaceSecondsPerKm = 180.0, // 3:00
            activeEnergyBurned = 620.0,
        )
        assertEquals("10.00", item.formattedDistance)
        assertEquals("30:00", item.formattedDuration)
        assertEquals("3:00", item.formattedPace)
    }
}
