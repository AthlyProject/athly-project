package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/** Espelha `UserProfile` do iOS (APIClient.swift). */
@Serializable
data class UserProfileDto(
    val id: String,
    val name: String? = null,
    val username: String? = null,
    val email: String,
    val weight: Double? = null,
    val height: Double? = null,
    val availableDays: List<String>? = null,
    val assessmentCompleted: Boolean? = null,
)

/** Espelha `UpdateProfileRequest` do iOS. Campos nulos são omitidos no JSON (como encodeIfPresent). */
@Serializable
data class UpdateProfileRequest(
    val name: String? = null,
    val weight: Double? = null,
    val availableDays: List<String>? = null,
)
