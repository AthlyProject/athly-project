package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/**
 * Espelha `WorkoutBlock` do iOS. O init(from:) do iOS aceita chaves alternativas
 * (`durationMinutes`/`distanceKm`) e default de `type` — aqui mantemos os campos crus e
 * expomos os valores resolvidos; o mapper de domínio (prompt 03) usa `resolvedDuration/Distance`.
 */
@Serializable
data class WorkoutBlockDto(
    val type: String = "rest",
    val duration: Double? = null,
    val durationMinutes: Double? = null,
    val distance: Double? = null,
    val distanceKm: Double? = null,
    /** Backend envia no formato "M:SS" (ex.: "5:12"), não número. Converter só no domínio. */
    val targetPace: String? = null,
    val instructions: String? = null,
) {
    val resolvedDuration: Double? get() = duration ?: durationMinutes
    val resolvedDistance: Double? get() = distance ?: distanceKm
}

/** Espelha `WorkoutModel` do iOS. Datas ficam como String (parse tolerante no domínio). */
@Serializable
data class WorkoutDto(
    val id: String,
    val date: String,
    val sportType: SportType,
    val title: String,
    val description: String? = null,
    val blocks: List<WorkoutBlockDto> = emptyList(),
    /** Árvore estruturada; quando presente é a fonte da verdade do tracker (prompt 07+). */
    val segments: WorkoutSegmentsDto? = null,
    val status: WorkoutStatus,
    val trainingPlanId: String? = null,
    val weeklyGoalId: String? = null,
    /** Backend pode enviar inteiro ou decimal; Double cobre os dois. */
    val intensity: Double? = null,
    val isGoalAttempt: Boolean? = null,
    /** Mantido apenas por paridade de contrato — NÃO expor na UI (Strava fora até o lançamento). */
    val stravaActivityId: String? = null,
    val appleHealthWorkoutUUID: String? = null,
)

/** Espelha `CompleteWorkoutRequest` do iOS. No Android o UUID vem do Health Connect. */
@Serializable
data class CompleteWorkoutRequest(
    val appleHealthWorkoutUUID: String,
    val actualDistanceMeters: Double? = null,
    val actualDurationSeconds: Double? = null,
)

/** Espelha `WorkoutFeedbackRequest` do iOS. */
@Serializable
data class WorkoutFeedbackRequest(
    val completed: Boolean,
    val effort: Int,
    val fatigue: Int,
)
