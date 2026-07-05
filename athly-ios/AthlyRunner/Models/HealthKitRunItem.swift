import Foundation

/// Modelo de apresentação para uma corrida lida do HealthKit (somente leitura).
struct HealthKitRunItem: Identifiable, Codable, Equatable, Sendable {
    let id: String
    let startDate: Date
    let endDate: Date
    let durationSeconds: Double
    let distanceMeters: Double
    let averagePaceSecondsPerKm: Double
    let activeEnergyBurned: Double
    let elevationGainMeters: Double?

    var distanceKm: Double {
        distanceMeters / 1000.0
    }

    var formattedDistance: String {
        String(format: "%.2f", distanceKm)
    }

    var formattedDuration: String {
        let hours = Int(durationSeconds) / 3600
        let minutes = (Int(durationSeconds) % 3600) / 60
        let seconds = Int(durationSeconds) % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%02d:%02d", minutes, seconds)
    }

    var formattedPace: String {
        guard averagePaceSecondsPerKm > 0, averagePaceSecondsPerKm.isFinite else {
            return "--:--"
        }
        let minutes = Int(averagePaceSecondsPerKm) / 60
        let seconds = Int(averagePaceSecondsPerKm) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
