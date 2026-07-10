package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/** Espelha `TrainingPlanResponse` do iOS. Datas como String (parse tolerante no domínio). */
@Serializable
data class TrainingPlanDto(
    val id: String,
    val startDate: String,
    val objective: String,
    val targetDate: String? = null,
    val sports: List<SportType> = emptyList(),
    val autoGenerate: Boolean = false,
    /** Nullable para tolerar respostas antigas. Valores: ACTIVE | DRAFT | COMPLETED | CANCELLED | LOCKED. */
    val status: String? = null,
    val createdAt: String,
    val updatedAt: String,
)

/** Espelha `WeeklyGoalMetrics` do iOS (métricas do RunAnalysis persistidas pelo AI planner). */
@Serializable
data class WeeklyGoalMetricsDto(
    val title: String? = null,
    val trend: String? = null,
    val fitnessInsights: String? = null,
    val avgPace: String? = null,
    val totalDistanceKm: Double? = null,
    val runsAnalyzed: Int? = null,
    val period: String? = null,
    val avgDistanceKm: Double? = null,
    val avgHeartRate: Double? = null,
)

/** Espelha `PreviousWeekAnalysis` do iOS. */
@Serializable
data class PreviousWeekAnalysisDto(
    val completedWorkouts: Int? = null,
    val totalWorkouts: Int? = null,
    val completionRate: Double? = null,
    val totalDistanceKm: Double? = null,
    val avgEffort: Double? = null,
    val avgFatigue: Double? = null,
    val skippedWorkouts: List<String>? = null,
    val volumeChange: String? = null,
)

/** Espelha `WeeklyGoalResponse` do iOS. */
@Serializable
data class WeeklyGoalDto(
    val id: String,
    val trainingPlanId: String,
    val weekStartDate: String,
    val weekEndDate: String,
    val status: WeeklyGoalStatus,
    val metrics: WeeklyGoalMetricsDto? = null,
    val previousWeekAnalysis: PreviousWeekAnalysisDto? = null,
)

/** Espelha `RunAnalysis` do iOS (resumo gerado pela IA). */
@Serializable
data class RunAnalysisDto(
    val title: String? = null,
    val runsAnalyzed: Int,
    val period: String,
    val avgDistanceKm: Double,
    val avgPace: String,
    /** Backend pode enviar inteiro ou decimal; Double cobre os dois. */
    val avgHeartRate: Double? = null,
    val totalDistanceKm: Double,
    val trend: String,
    val fitnessInsights: String,
)
