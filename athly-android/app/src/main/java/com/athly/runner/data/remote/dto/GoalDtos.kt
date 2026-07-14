package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/** Espelha `ParsedGoal` do iOS. */
@Serializable
data class ParsedGoalDto(
    val isRunningRelated: Boolean,
    val targetDistance: String? = null,
    val targetTime: String? = null,
    val eventDate: String? = null,
    val eventName: String? = null,
    val experienceLevel: String? = null,
    val summary: String,
    val rejectionReason: String? = null,
)

/** Espelha `CreateGoalRequest` do iOS. */
@Serializable
data class CreateGoalRequest(
    val goalText: String,
)

/** Espelha `GoalFeasibility` do iOS (veredito determinístico VDOT). */
@Serializable
data class GoalFeasibilityDto(
    /** ready | feasible | ambitious | unrealistic */
    val verdict: String,
    val currentVdot: Double,
    val requiredVdot: Double,
    val projectedVdot: Double,
    val targetDistanceMeters: Double,
    val targetTimeSec: Double,
    val currentProjectedTimeSec: Double,
    val weeksAvailable: Double,
    val lowConfidence: Boolean,
    val suggestion: SuggestionDto? = null,
) {
    @Serializable
    data class SuggestionDto(
        val realisticTimeSec: Double? = null,
        val suggestedDate: String? = null,
    )
}

/** Espelha `CreateGoalResponse` do iOS (também retornado por GET /goals/active). */
@Serializable
data class CreateGoalResponse(
    val id: String,
    val rawText: String,
    val parsedGoal: ParsedGoalDto,
    val feasibility: GoalFeasibilityDto? = null,
    val active: Boolean,
    val createdAt: String,
)
