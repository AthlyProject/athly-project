import Foundation

enum FeatureFlags {
    /// Liga o paywall (gating de assinatura). `true` agora que o RevenueCat está integrado.
    /// Com `false`, todo o gating é fail-open (ninguém é bloqueado).
    static let paywallEnabled = true
}
