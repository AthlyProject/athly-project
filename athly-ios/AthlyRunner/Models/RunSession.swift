import Foundation
import SwiftData
import CoreLocation

@Model
final class RunSession {
    var id: UUID
    var startDate: Date
    var endDate: Date?
    var distanceMeters: Double
    var durationSeconds: Double
    var averagePaceSecondsPerKm: Double
    var elevationGainMeters: Double
    var caloriesBurned: Double
    var status: String // active, paused, completed
    var sportType: String // running, walking, trail

    @Relationship(deleteRule: .cascade)
    var routePoints: [RoutePoint]

    @Relationship(deleteRule: .cascade)
    var splits: [Split]

    // Sync with backend
    var backendId: String?
    var synced: Bool

    init(sportType: String = "running") {
        self.id = UUID()
        self.startDate = Date()
        self.endDate = nil
        self.distanceMeters = 0
        self.durationSeconds = 0
        self.averagePaceSecondsPerKm = 0
        self.elevationGainMeters = 0
        self.caloriesBurned = 0
        self.status = "active"
        self.sportType = sportType
        self.routePoints = []
        self.splits = []
        self.backendId = nil
        self.synced = false
    }

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
