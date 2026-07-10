package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/* Espelham a seção "Admin Weekly Report" do APIModels.swift. */

@Serializable
data class AdminPromptLogDto(
    val promptText: String,
    val rawResponse: String,
    val modelUsed: String,
    val promptVersion: String,
    val generationType: String,
    val createdAt: String,
)

@Serializable
data class AdminWorkoutSummaryDto(
    val id: String,
    val dateScheduled: String,
    val title: String,
    val description: String? = null,
    val status: String,
    val actualDistanceMeters: Double? = null,
    val actualDurationSeconds: Double? = null,
)

@Serializable
data class AdminWeeklyReportDto(
    val id: String,
    val weekStartDate: String,
    val weekEndDate: String,
    val metrics: WeeklyGoalMetricsDto? = null,
    val previousWeekAnalysis: PreviousWeekAnalysisDto? = null,
    val promptLog: AdminPromptLogDto? = null,
    val workouts: List<AdminWorkoutSummaryDto> = emptyList(),
)
