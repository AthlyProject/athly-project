import Foundation

struct Split: Identifiable, Codable {
    let id: UUID
    let kilometer: Int
    let durationSeconds: Double
    let paceSecondsPerKm: Double
    let elevationDelta: Double

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
