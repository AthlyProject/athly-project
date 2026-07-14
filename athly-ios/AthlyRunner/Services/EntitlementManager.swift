import Foundation
import SwiftUI

/// Fonte única de verdade do entitlement pago no app.
/// `isEntitled` = entitlement do RevenueCat ativo **OU** o backend libera (cobre o bypass de admin
/// via `ADMIN_EMAILS`, então admin/dev nunca vê paywall nem precisa comprar).
/// Enquanto `FeatureFlags.paywallEnabled == false`, é sempre true (fail-open).
@MainActor
final class EntitlementManager: ObservableObject {
    @Published private(set) var isEntitled: Bool = true
    @Published private(set) var isFounderEligible: Bool = false
    /// Dias restantes do trial backend (banner "X dias restantes"). Nil = sem banner
    /// (paywall desligado, admin, assinante ativo ou trial expirado).
    @Published private(set) var trialDaysRemaining: Int? = nil

    private let purchaseManager: PurchaseManager

    init(purchaseManager: PurchaseManager = RevenueCatPurchaseManager()) {
        self.purchaseManager = purchaseManager
        // Roda após o App.init() (onde o RevenueCat é configurado): seguro acessar o SDK aqui.
        Task { [weak self] in
            await self?.refresh()
            await self?.observeEntitlementUpdates()
        }
        observeAuthChanges()
    }

    /// Liga/desliga o app_user_id do RevenueCat conforme o login/logout do app (postado pelo
    /// `AuthViewModel`). Mantém o `EntitlementManager` como dono da integração — o `AuthViewModel`
    /// só avisa, sem importar o SDK.
    private func observeAuthChanges() {
        NotificationCenter.default.addObserver(
            forName: .athlyAuthChanged, object: nil, queue: .main
        ) { [weak self] note in
            let authenticated = (note.userInfo?["authenticated"] as? Bool) ?? false
            Task { @MainActor [weak self] in
                guard let self else { return }
                if authenticated, let userId = await APIClient.shared.currentUserId() {
                    await self.identify(userId)
                } else {
                    await self.signOut()
                }
            }
        }
    }

    /// True se o usuário pode usar recursos pagos agora (ou se o paywall está desligado).
    var canUsePremium: Bool {
        !FeatureFlags.paywallEnabled || isEntitled
    }

    func refresh() async {
        guard FeatureFlags.paywallEnabled else {
            isEntitled = true
            trialDaysRemaining = nil
            return
        }
        async let rcActive = purchaseManager.hasActiveEntitlement()
        let backendEntitlement = try? await APIClient.shared.getEntitlement()
        let backendEntitled = backendEntitlement?.entitled ?? false
        isFounderEligible = backendEntitlement?.isFounderEligible ?? false
        trialDaysRemaining = backendEntitlement?.trialDaysRemaining
        isEntitled = await rcActive || backendEntitled
    }

    /// Liga o RevenueCat ao id do usuário Athly (app_user_id = id Athly, para casar com o webhook).
    func identify(_ userId: String) async {
        await purchaseManager.identify(appUserId: userId)
        let profile = try? await APIClient.shared.getUserProfile()
        await refresh()
        await purchaseManager.syncSubscriberAttributes(
            email: profile?.email,
            isFounderEligible: isFounderEligible
        )
    }

    func signOut() async {
        isFounderEligible = false
        trialDaysRemaining = nil
        await purchaseManager.signOut()
        await refresh()
    }

    func purchase() async throws {
        try await purchaseManager.purchaseDefaultProduct()
        await refresh()
    }

    func restore() async throws {
        try await purchaseManager.restorePurchases()
        await refresh()
    }

    /// Reage a renovação/expiração/compra fora do app. Em mudança do RevenueCat, se ativou libera
    /// na hora; se desativou, re-checa o backend (mantém o override de admin).
    private func observeEntitlementUpdates() async {
        for await active in purchaseManager.entitlementUpdates() {
            if active {
                isEntitled = true
            } else {
                await refresh()
            }
        }
    }
}
