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
    var avgHR: Double? = nil
    var maxHR: Double? = nil
    /// App que gravou o treino (HKSource.bundleIdentifier).
    var sourceBundleIdentifier: String? = nil
    /// HKMetadataKeyWasUserEntered: treino digitado à mão, não medido.
    var wasUserEntered: Bool? = nil

    var distanceKm: Double {
        distanceMeters / 1000.0
    }

    var formattedDistance: String {
        LocalizedFormatting.formattedDistanceKm(distanceKm)
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
