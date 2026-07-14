package com.athly.runner.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class IsoDatesTest {

    @Test
    fun `parse tolerante cobre os tres formatos do backend`() {
        // ISO8601 com fração (formato do parsedDate iOS)
        assertNotNull(IsoDates.parseInstant("2026-07-06T10:15:30.123Z"))
        // ISO8601 sem fração
        assertNotNull(IsoDates.parseInstant("2026-07-06T10:15:30Z"))
        // Offset explícito
        assertNotNull(IsoDates.parseInstant("2026-07-06T10:15:30+02:00"))
        // Date-only → início do dia
        val dateOnly = IsoDates.parseInstant("2026-07-06", ZoneOffset.UTC)!!
        assertEquals("2026-07-06T00:00:00Z", dateOnly.toString())
    }

    @Test
    fun `parseLocalDate corta strings ISO completas como o prefix(10) do iOS`() {
        assertEquals(LocalDate.of(2026, 7, 6), IsoDates.parseLocalDate("2026-07-06T10:15:30.123Z"))
        assertEquals(LocalDate.of(2026, 7, 6), IsoDates.parseLocalDate("2026-07-06"))
        assertNull(IsoDates.parseLocalDate("hoje"))
        assertNull(IsoDates.parseInstant("hoje"))
    }
}
