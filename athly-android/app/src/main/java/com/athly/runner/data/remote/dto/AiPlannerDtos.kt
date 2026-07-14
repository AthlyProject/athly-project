package com.athly.runner.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/*
 * Payloads do AI planner — espelham a seção "Plan From Health" do APIModels.swift.
 * No Android os dados vêm do Health Connect (prompt 12), mas as chaves do contrato
 * (ex.: appleHealthWorkoutUUID) são mantidas como o backend espera.
 */

/** Espelha `HealthRunPayload` do iOS. */
@Serializable
data class HealthRunPayload(
    val startDate: String,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val averagePaceSecondsPerKm: Double,
    val activeEnergyBurned: Double,
    val elevationGainMeters: Double? = null,
)

/** Espelha `SegmentLabel` do iOS (labels dos splits enviados à IA). */
@Serializable
enum class SegmentLabel {
    @SerialName("warmup") WARMUP,
    @SerialName("easy") EASY,
    @SerialName("tempo") TEMPO,
    @SerialName("rep") REP,
    @SerialName("rec") REC,
    @SerialName("cooldown") COOLDOWN,
}

/** Espelha `SegmentPayload` do iOS. */
@Serializable
data class SegmentPayload(
    val label: SegmentLabel,
    val index: Int? = null,
    val distanceKm: Double,
    val durationSeconds: Double,
    val avgPaceSecondsPerKm: Double? = null,
    val avgHR: Double? = null,
    val peakHR: Double? = null,
    val endHR: Double? = null,
)

/** Espelha `DetailedSessionPayload` do iOS (sessão detalhada para análise de execução da IA). */
@Serializable
data class DetailedSessionPayload(
    val startDate: String,
    /** Chave do contrato backend; no Android carrega o id do Health Connect. */
    val appleHealthWorkoutUUID: String,
    val athlyWorkoutId: String? = null,
    val distanceMeters: Double,
    val durationSeconds: Double,
    val averagePaceSecondsPerKm: Double? = null,
    val avgHR: Double? = null,
    val maxHR: Double? = null,
    val activeEnergyBurned: Double? = null,
    val elevationGainMeters: Double? = null,
    val segments: List<SegmentPayload>,
    /** "events" | "route" | "synthetic" — fonte dos splits, para análise de confiança. */
    val splitsSource: String? = null,
)

/** Espelha `PlanFromHealthRequest` do iOS. */
@Serializable
data class PlanFromHealthRequest(
    val runs: List<HealthRunPayload>,
    val detailedSessions: List<DetailedSessionPayload>? = null,
    val weekStartDate: String? = null,
)

/** Espelha `AiPlannerResponse` do iOS. */
@Serializable
data class AiPlannerResponse(
    val weeklyGoal: WeeklyGoalDto,
    val workouts: List<WorkoutDto>,
    val analysis: RunAnalysisDto,
)

/** Espelha `AiPlannerGenerationStartResponse` do iOS (geração assíncrona). */
@Serializable
data class AiPlannerGenerationStartResponse(
    val generationId: String,
    val status: String,
    val pollAfterSeconds: Int,
    val message: String,
)

/** Espelha `AiPlannerGenerationStatusResponse` do iOS. */
@Serializable
data class AiPlannerGenerationStatusResponse(
    val generationId: String,
    val status: String,
    val pollAfterSeconds: Int,
    val message: String,
    val error: String? = null,
)
