import Foundation
import SwiftData

@Model
final class Split {
    var id: UUID
    var kilometer: Int
    var durationSeconds: Double
    var paceSecondsPerKm: Double
    var elevationDelta: Double

    var runSession: RunSession?

    init(kilometer: Int, durationSeconds: Double, elevationDelta: Double = 0) {
        self.id = UUID()
        self.kilometer = kilometer
        self.durationSeconds = durationSeconds
        self.paceSecondsPerKm = durationSeconds
        self.elevationDelta = elevationDelta
    }

    var formattedPace: String {
        let minutes = Int(paceSecondsPerKm) / 60
        let seconds = Int(paceSecondsPerKm) % 60
        return String(format: "%d:%02d /km", minutes, seconds)
    }
}
