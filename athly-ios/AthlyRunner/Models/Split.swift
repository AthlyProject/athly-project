import Foundation

struct Split: Identifiable, Codable {
    let id: UUID
    let kilometer: Int
    let durationSeconds: Double
    let paceSecondsPerKm: Double
    let elevationDelta: Double

    init(kilometer: Int, durationSeconds: Double, distanceMeters: Double = 1000, elevationDelta: Double = 0) {
        self.id = UUID()
        self.kilometer = kilometer
        self.durationSeconds = durationSeconds
        // Pace derivado da distância real do segmento (km parcial final sai correto também).
        self.paceSecondsPerKm = distanceMeters > 0 ? durationSeconds / (distanceMeters / 1000.0) : 0
        self.elevationDelta = elevationDelta
    }

    var formattedPace: String {
        let minutes = Int(paceSecondsPerKm) / 60
        let seconds = Int(paceSecondsPerKm) % 60
        return String(format: "%d:%02d /km", minutes, seconds)
    }
}
