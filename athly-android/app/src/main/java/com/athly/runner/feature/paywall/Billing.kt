package com.athly.runner.feature.paywall

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Espelha `FeatureFlags.swift`: com `false`, todo o gating é fail-open (ninguém bloqueado). */
object FeatureFlags {
    const val PAYWALL_ENABLED = false
}

/**
 * Interface de compras — espelha o `protocol PurchaseManager` do iOS. Plugar RevenueCat Android /
 * Play Billing depois, implementando esta interface sem mudar o resto do app.
 */
interface PurchaseManager {
    suspend fun hasActiveEntitlement(): Boolean
    suspend fun purchaseDefaultProduct()
    suspend fun restorePurchases()
}

class PurchaseNotConfiguredException :
    Exception("Assinaturas ainda não estão disponíveis nesta versão.")

/** Espelha `StubPurchaseManager` do iOS: sem entitlement; compra/restore lançam `notConfigured`. */
@Singleton
class StubPurchaseManager @Inject constructor() : PurchaseManager {
    override suspend fun hasActiveEntitlement(): Boolean = false
    override suspend fun purchaseDefaultProduct(): Unit = throw PurchaseNotConfiguredException()
    override suspend fun restorePurchases(): Unit = throw PurchaseNotConfiguredException()
}

/**
 * Fonte única de verdade do premium — espelha `EntitlementManager.swift`. Fail-open enquanto o
 * paywall está desligado; o entitlement real (trial de 7 dias + assinatura) é validado server-side
 * pelo SubscriptionGuard — o paywall do cliente é cosmético até ligar.
 */
@Singleton
class EntitlementManager @Inject constructor(
    private val purchaseManager: StubPurchaseManager,
) {
    private val _isEntitled = MutableStateFlow(true)
    val isEntitled: StateFlow<Boolean> = _isEntitled.asStateFlow()

    val canUsePremium: Boolean get() = !FeatureFlags.PAYWALL_ENABLED || _isEntitled.value

    suspend fun refresh() {
        _isEntitled.value = if (!FeatureFlags.PAYWALL_ENABLED) true else purchaseManager.hasActiveEntitlement()
    }

    suspend fun purchase() {
        purchaseManager.purchaseDefaultProduct()
        refresh()
    }

    suspend fun restore() {
        purchaseManager.restorePurchases()
        refresh()
    }
}
