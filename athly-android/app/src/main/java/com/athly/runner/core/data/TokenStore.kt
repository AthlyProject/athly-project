package com.athly.runner.core.data

/**
 * Armazenamento seguro dos tokens de auth — espelha o KeychainHelper do iOS.
 * Interface para permitir fake em testes JVM (EncryptedSharedPreferences exige Android).
 */
interface TokenStore {
    fun save(access: String, refresh: String)
    fun accessToken(): String?
    fun refreshToken(): String?
    fun clear()

    /** Espelha `APIClient.isAuthenticated` do iOS (tem access token). */
    fun hasTokens(): Boolean = accessToken() != null
}
