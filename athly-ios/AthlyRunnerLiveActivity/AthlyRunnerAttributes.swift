import ActivityKit
import Foundation

/// Atributos da Live Activity de corrida.
/// Definido no target da extension e referenciado pelo app principal via project.yml sources.
struct AthlyRunnerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        /// Tempo decorrido em segundos
        var elapsedSeconds: Int
        /// Distância percorrida em metros
        var distanceMeters: Double
        /// Pace atual em segundos por km (0 = sem dado)
        var paceSecondsPerKm: Double
    }

    /// Título do treino prescrito (se o usuário iniciou a corrida a partir de um treino)
    var workoutTitle: String
}

// MARK: - Convenience formatters

extension AthlyRunnerAttributes.ContentState {
    var formattedTime: String {
        let h = elapsedSeconds / 3600
        let m = (elapsedSeconds % 3600) / 60
        let s = elapsedSeconds % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%02d:%02d", m, s)
    }

    var formattedDistance: String {
        String(format: "%.2f", distanceMeters / 1000.0)
    }

    var formattedPace: String {
        guard paceSecondsPerKm > 0, paceSecondsPerKm.isFinite, paceSecondsPerKm < 3600 else {
            return "--:--"
        }
        let m = Int(paceSecondsPerKm) / 60
        let s = Int(paceSecondsPerKm) % 60
        return String(format: "%d:%02d", m, s)
    }
}
