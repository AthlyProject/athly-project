import Foundation

struct RunTargetAlert: Equatable, Sendable {
    enum Kind: String, CaseIterable, Sendable {
        case distance
        case time
    }

    let kind: Kind
    /// User-facing value: kilometers for distance, minutes for time.
    let value: Double

    init?(kind: Kind, value: Double) {
        guard value.isFinite, value > 0 else { return nil }
        self.kind = kind
        self.value = value
    }

    var thresholdMeters: Double? {
        guard kind == .distance else { return nil }
        return value * 1000
    }

    var thresholdSeconds: TimeInterval? {
        guard kind == .time else { return nil }
        return value * 60
    }

    var displayValue: String {
        switch kind {
        case .distance:
            return String(localized: "\(Self.formatDecimal(value)) km")
        case .time:
            return Self.formatDuration(seconds: Int((value * 60).rounded()))
        }
    }

    var spokenValue: String {
        WorkoutSpeechFormatter().targetValue(self)
    }

    private static func formatDecimal(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = .current
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    private static func formatDuration(seconds: Int) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        if remainingSeconds == 0 { return String(localized: "\(minutes) min") }
        return String(localized: "\(minutes)m \(remainingSeconds)s")
    }
}
