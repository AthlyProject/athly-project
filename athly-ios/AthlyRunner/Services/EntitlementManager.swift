import Foundation
import SwiftUI

/// Fonte única de verdade do entitlement premium no app.
/// Enquanto `FeatureFlags.paywallEnabled == false`, `canUsePremium` é sempre true (fail-open).
/// O trial de 7 dias e a assinatura são também validados pelo backend (SubscriptionGuard).
@MainActor
final class EntitlementManager: ObservableObject {
    @Published private(set) var isEntitled: Bool = true

    private let purchaseManager: PurchaseManager

    init(purchaseManager: PurchaseManager = StubPurchaseManager()) {
        self.purchaseManager = purchaseManager
        Task { await refresh() }
    }

    /// True se o usuário pode usar recursos premium agora (ou se o paywall está desligado).
    var canUsePremium: Bool {
        !FeatureFlags.paywallEnabled || isEntitled
    }

    func refresh() async {
        guard FeatureFlags.paywallEnabled else {
            isEntitled = true
            return
        }
        isEntitled = await purchaseManager.hasActiveEntitlement()
    }

    func purchase() async throws {
        try await purchaseManager.purchaseDefaultProduct()
        await refresh()
    }

    func restore() async throws {
        try await purchaseManager.restorePurchases()
        await refresh()
    }
}
