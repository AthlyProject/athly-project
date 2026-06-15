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
        /// Início "virtual" do cronômetro (agora − tempo decorrido, pausas já descontadas).
        /// Permite ao widget renderizar Text(timerInterval:) — o relógio anda sozinho no
        /// processo do widget, sem o app empurrar update a cada segundo.
        var startedAt: Date? = nil
        /// Pausado → o widget mostra o tempo estático (elapsedSeconds congelado).
        var isPaused: Bool = false
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
        let total = Int(paceSecondsPerKm.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
