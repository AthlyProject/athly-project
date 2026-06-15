import Foundation
import RevenueCat

/// Identificadores do RevenueCat. O `entitlementID` precisa bater EXATAMENTE com o identifier do
/// entitlement no dashboard do RevenueCat (case/espaço-sensível).
enum Entitlements {
    static let athlyBasic = "Athly Basic"
}

/// Abstração sobre o provedor de compras (RevenueCat). Mantém o resto do app desacoplado do SDK.
protocol PurchaseManager: Sendable {
    /// True se o entitlement premium ("Athly Basic") está ativo no `CustomerInfo` atual.
    func hasActiveEntitlement() async -> Bool
    /// Compra o primeiro pacote da offering atual (fallback — o fluxo principal é o Paywall do RevenueCatUI).
    func purchaseDefaultProduct() async throws
    func restorePurchases() async throws
    /// Liga o `app_user_id` do RevenueCat ao id do usuário Athly (para o webhook casar no backend).
    func identify(appUserId: String) async
    func signOut() async
    /// Stream que emite `isActive` do entitlement a cada mudança de `CustomerInfo` (renovação, expiração…).
    func entitlementUpdates() -> AsyncStream<Bool>
}

/// Implementação real sobre o SDK do RevenueCat (StoreKit 2).
struct RevenueCatPurchaseManager: PurchaseManager {
    func hasActiveEntitlement() async -> Bool {
        guard Purchases.isConfigured else { return false }
        let info = try? await Purchases.shared.customerInfo()
        return info?.entitlements[Entitlements.athlyBasic]?.isActive == true
    }

    func purchaseDefaultProduct() async throws {
        let offering = try await Purchases.shared.offerings().current
        guard let package = offering?.availablePackages.first else {
            throw PurchaseError.notConfigured
        }
        _ = try await Purchases.shared.purchase(package: package)
    }

    func restorePurchases() async throws {
        _ = try await Purchases.shared.restorePurchases()
    }

    func identify(appUserId: String) async {
        guard Purchases.isConfigured else { return }
        _ = try? await Purchases.shared.logIn(appUserId)
    }

    func signOut() async {
        guard Purchases.isConfigured else { return }
        _ = try? await Purchases.shared.logOut()
    }

    func entitlementUpdates() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            guard Purchases.isConfigured else { continuation.finish(); return }
            let task = Task {
                for await info in Purchases.shared.customerInfoStream {
                    continuation.yield(info.entitlements[Entitlements.athlyBasic]?.isActive == true)
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

/// Stub para previews/simulador (sem SDK ativo). Não realiza compras.
struct StubPurchaseManager: PurchaseManager {
    func hasActiveEntitlement() async -> Bool { false }
    func purchaseDefaultProduct() async throws { throw PurchaseError.notConfigured }
    func restorePurchases() async throws { throw PurchaseError.notConfigured }
    func identify(appUserId: String) async {}
    func signOut() async {}
    func entitlementUpdates() -> AsyncStream<Bool> { AsyncStream { $0.finish() } }
}

enum PurchaseError: LocalizedError {
    case notConfigured

    var errorDescription: String? {
        "Assinaturas ainda não estão disponíveis nesta versão."
    }
}
