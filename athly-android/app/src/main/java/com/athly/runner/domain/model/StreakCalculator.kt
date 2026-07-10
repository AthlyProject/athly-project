package com.athly.runner.domain.model

import com.athly.runner.data.remote.dto.WorkoutStatus
import java.time.LocalDate

/**
 * Sequência (ofensiva) de treinos concluídos — porta 1:1 de `StreakCalculator.swift`. Pura e testável.
 *
 * Conta treinos prescritos consecutivos concluídos (`done`/`partial`), de hoje para trás. **Quebra** em
 * `skipped` ou em treino **passado** ainda `scheduled` (não-marcado = não treinou). O de **hoje** pendente
 * é **neutro**. Futuros são ignorados. Filtrar `other`/descanso é responsabilidade do chamador.
 */
object StreakCalculator {

    data class Entry(val date: LocalDate, val status: WorkoutStatus)

    fun currentStreak(entries: List<Entry>, today: LocalDate = LocalDate.now()): Int {
        val due = entries
            .filter { it.date <= today }
            .sortedByDescending { it.date } // mais recente primeiro

        var streak = 0
        for (entry in due) {
            when (entry.status) {
                WorkoutStatus.DONE, WorkoutStatus.PARTIAL -> streak += 1
                WorkoutStatus.SCHEDULED -> {
                    if (entry.date == today) continue // pendente de hoje: neutro
                    return streak // passado não-marcado: quebra
                }
                WorkoutStatus.SKIPPED -> return streak
            }
        }
        return streak
    }
}
