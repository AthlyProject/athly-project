package com.athly.runner.data.remote.dto

import kotlinx.serialization.Serializable

/**
 * Espelha `EntitlementResponse` do iOS — snapshot de entitlement do backend
 * (fonte de verdade do bypass de admin via ADMIN_EMAILS). Consumido no prompt 22.
 */
@Serializable
data class EntitlementDto(
    val entitled: Boolean,
    val isAdmin: Boolean,
    val isFounderEligible: Boolean? = null,
    /** Fim do trial backend (ISO). Null quando não aplicável (admin, assinante ou expirado). */
    val trialEndsAt: String? = null,
    val trialDaysRemaining: Int? = null,
)
