package com.athly.runner.domain.model

import com.athly.runner.data.remote.dto.WorkoutStatus
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

/** Porta 1:1 da regra do `StreakCalculator.swift` — casos espelhando o comportamento do iOS. */
class StreakCalculatorTest {

    private val today: LocalDate = LocalDate.of(2026, 7, 10)

    private fun entry(daysAgo: Long, status: WorkoutStatus) =
        StreakCalculator.Entry(today.minusDays(daysAgo), status)

    @Test
    fun `treinos concluidos consecutivos contam de hoje pra tras`() {
        val entries = listOf(
            entry(0, WorkoutStatus.DONE),
            entry(1, WorkoutStatus.PARTIAL),
            entry(2, WorkoutStatus.DONE),
        )
        assertEquals(3, StreakCalculator.currentStreak(entries, today))
    }

    @Test
    fun `skipped quebra a sequencia`() {
        val entries = listOf(
            entry(0, WorkoutStatus.DONE),
            entry(1, WorkoutStatus.SKIPPED),
            entry(2, WorkoutStatus.DONE),
        )
        assertEquals(1, StreakCalculator.currentStreak(entries, today))
    }

    @Test
    fun `passado nao-marcado quebra`() {
        val entries = listOf(
            entry(0, WorkoutStatus.DONE),
            entry(1, WorkoutStatus.SCHEDULED),
            entry(2, WorkoutStatus.DONE),
        )
        assertEquals(1, StreakCalculator.currentStreak(entries, today))
    }

    @Test
    fun `pendente de hoje e neutro`() {
        val entries = listOf(
            entry(0, WorkoutStatus.SCHEDULED),
            entry(1, WorkoutStatus.DONE),
            entry(2, WorkoutStatus.DONE),
        )
        assertEquals(2, StreakCalculator.currentStreak(entries, today))
    }

    @Test
    fun `futuros sao ignorados`() {
        val entries = listOf(
            StreakCalculator.Entry(today.plusDays(1), WorkoutStatus.SCHEDULED),
            entry(0, WorkoutStatus.DONE),
        )
        assertEquals(1, StreakCalculator.currentStreak(entries, today))
    }

    @Test
    fun `sem entradas retorna zero`() {
        assertEquals(0, StreakCalculator.currentStreak(emptyList(), today))
    }
}
