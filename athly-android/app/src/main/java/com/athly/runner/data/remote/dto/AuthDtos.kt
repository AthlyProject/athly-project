package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/* Espelham os structs de auth do APIClient.swift. */

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val userName: String,
    val name: String,
    val password: String,
    val confirmPassword: String,
    val dateOfBirth: String,
    val weight: Double,
    val height: Double,
)

@Serializable
data class AuthResponse(
    val accessToken: String,
    val refreshToken: String,
)

@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
data class RefreshResponse(
    val accessToken: String,
    val refreshToken: String,
)
