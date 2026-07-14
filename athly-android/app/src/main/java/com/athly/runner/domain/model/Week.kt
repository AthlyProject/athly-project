package com.athly.runner.domain.model

import com.athly.runner.data.remote.dto.WeeklyGoalDto
import com.athly.runner.data.remote.dto.WorkoutDto

/**
 * Uma semana do plano — espelha `Week` do iOS: workouts do goal, ordenados por data.
 * `number` é 1-based na ordem dos goals.
 */
data class Week(
    val id: String,
    val number: Int,
    val weeklyGoal: WeeklyGoalDto?,
    val workouts: List<WorkoutDto>,
)
