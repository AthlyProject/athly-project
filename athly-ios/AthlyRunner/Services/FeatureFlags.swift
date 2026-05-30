import Foundation

enum FeatureFlags {
    /// Liga o paywall (gating de assinatura). Mantenha `false` até o RevenueCat + App Store Connect
    /// estarem configurados. Com `false`, todo o gating é fail-open (ninguém é bloqueado).
    static let paywallEnabled = false
}
