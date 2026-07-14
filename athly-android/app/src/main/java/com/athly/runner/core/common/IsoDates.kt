package com.athly.runner.core.common

import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeParseException

/**
 * Parser tolerante das datas do backend — espelha o `parsedDate` do WorkoutModel iOS:
 * ISO8601 com fração, ISO8601 sem fração, ou apenas `yyyy-MM-dd` (vários campos vêm sem hora).
 * Usado pelos mappers de domínio (prompt 03); os DTOs guardam a String crua.
 */
object IsoDates {

    /** Instante do evento; date-only vira início do dia no fuso local (como o DateFormatter do iOS). */
    fun parseInstant(raw: String, zone: ZoneId = ZoneId.systemDefault()): Instant? {
        try {
            return Instant.parse(raw) // "2026-07-09T10:00:00Z" ou com fração
        } catch (_: DateTimeParseException) {
        }
        try {
            return OffsetDateTime.parse(raw).toInstant() // offset explícito, ex.: "+02:00"
        } catch (_: DateTimeParseException) {
        }
        return parseLocalDate(raw)?.atStartOfDay(zone)?.toInstant()
    }

    /** Só a parte da data (aceita string ISO completa — corta em 10 chars, como o prefix(10) do iOS). */
    fun parseLocalDate(raw: String): LocalDate? {
        if (raw.length < 10) return null
        return try {
            LocalDate.parse(raw.take(10))
        } catch (_: DateTimeParseException) {
            null
        }
    }
}
