import Foundation

/// Cache local de métricas do usuário usadas offline (ex.: peso para estimar calorias na corrida).
/// Populado no cadastro e ao carregar/editar o perfil.
enum UserMetrics {
    private static let weightKey = "athly_user_weight_kg"

    /// Peso em kg. `nil` quando desconhecido (o tracker cai no fallback padrão).
    static var weightKg: Double? {
        get {
            let value = UserDefaults.standard.double(forKey: weightKey)
            return value > 0 ? value : nil
        }
        set {
            if let newValue, newValue > 0 {
                UserDefaults.standard.set(newValue, forKey: weightKey)
            } else {
                UserDefaults.standard.removeObject(forKey: weightKey)
            }
        }
    }
}
