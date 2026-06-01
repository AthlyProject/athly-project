import Foundation

/// Abstração sobre o provedor de compras. O SDK do RevenueCat será plugado aqui
/// (implementando este protocolo) sem mudar o resto do app.
protocol PurchaseManager: Sendable {
    func hasActiveEntitlement() async -> Bool
    func purchaseDefaultProduct() async throws
    func restorePurchases() async throws
}

/// Stub usado enquanto o SDK do RevenueCat não está integrado. Não realiza compras.
struct StubPurchaseManager: PurchaseManager {
    func hasActiveEntitlement() async -> Bool { false }

    func purchaseDefaultProduct() async throws {
        throw PurchaseError.notConfigured
    }

    func restorePurchases() async throws {
        throw PurchaseError.notConfigured
    }
}

enum PurchaseError: LocalizedError {
    case notConfigured

    var errorDescription: String? {
        "Assinaturas ainda não estão disponíveis nesta versão."
    }
}
