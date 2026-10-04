import Foundation

enum FeatureFlags {
    /// Liga o paywall (gating de assinatura). `true` agora que o RevenueCat está integrado.
    /// Com `false`, todo o gating é fail-open (ninguém é bloqueado).
    static let paywallEnabled = true

    /// Tela "Relógio Garmin" em Ajustes. Só em builds de desenvolvimento até o app Connect IQ ser
    /// aprovado na loja da Garmin (sem ele publicado, não há como parear).
    static let garminWatchSync: Bool = {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }()

    /// Página do app Athly na Connect IQ Store, preenchida quando a loja aprovar o app.
    static let garminStoreURL: URL? = nil
}
