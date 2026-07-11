package com.athly.runner.data.repository

import com.athly.runner.core.common.AthlyResult
import com.athly.runner.core.common.onSuccess
import com.athly.runner.core.data.TokenStore
import com.athly.runner.core.network.apiCall
import com.athly.runner.data.remote.ApiService
import com.athly.runner.data.remote.dto.AuthResponse
import com.athly.runner.data.remote.dto.LoginRequest
import com.athly.runner.data.remote.dto.RegisterRequest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

/** Espelha os endpoints de auth do APIClient iOS + a persistência de tokens (setTokens/Keychain). */
@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
) {

    suspend fun login(email: String, password: String): AthlyResult<AuthResponse> =
        apiCall { api.login(LoginRequest(email = email, password = password)) }
            .onSuccess { tokenStore.save(it.accessToken, it.refreshToken) }

    suspend fun register(
        email: String,
        userName: String,
        name: String,
        password: String,
        confirmPassword: String,
        dateOfBirth: String,
        weight: Double,
        height: Double,
    ): AthlyResult<AuthResponse> =
        apiCall {
            api.register(
                RegisterRequest(
                    email = email,
                    userName = userName,
                    name = name,
                    password = password,
                    confirmPassword = confirmPassword,
                    dateOfBirth = dateOfBirth,
                    weight = weight,
                    height = height,
                ),
            )
        }.onSuccess { tokenStore.save(it.accessToken, it.refreshToken) }

    /** Espelha `APIClient.isAuthenticated`. */
    fun isAuthenticated(): Boolean = tokenStore.hasTokens()

    fun logout() {
        tokenStore.clear()
    }

    /**
     * Id do usuário Athly decodificado do claim `sub` do access token (JWT), sem rede —
     * espelha `currentUserId()` do iOS (usado pelo RevenueCat no prompt 22).
     */
    fun currentUserId(): String? {
        val token = tokenStore.accessToken() ?: return null
        return runCatching {
            val payload = token.split(".").getOrNull(1) ?: return null
            val decoded = String(Base64.getUrlDecoder().decode(payload))
            Json.parseToJsonElement(decoded).jsonObject["sub"]?.jsonPrimitive?.contentOrNull
        }.getOrNull()
    }
}
