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
            return "\(Self.formatDecimal(value)) km"
        case .time:
            return Self.formatDuration(seconds: Int((value * 60).rounded()), compact: true)
        }
    }

    var spokenValue: String {
        switch kind {
        case .distance:
            let meters = value * 1000
            if meters >= 1000 {
                return "\(Self.formatDecimal(value)) quilômetros"
            }
            return "\(Int(meters.rounded())) metros"
        case .time:
            return Self.formatDuration(seconds: Int((value * 60).rounded()), compact: false)
        }
    }

    private static func formatDecimal(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    private static func formatDuration(seconds: Int, compact: Bool) -> String {
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60

        if compact {
            if remainingSeconds == 0 { return "\(minutes) min" }
            return "\(minutes)m \(remainingSeconds)s"
        }

        if minutes == 0 {
            return "\(remainingSeconds) segundo\(remainingSeconds == 1 ? "" : "s")"
        }
        if remainingSeconds == 0 {
            return "\(minutes) minuto\(minutes == 1 ? "" : "s")"
        }
        return "\(minutes) minuto\(minutes == 1 ? "" : "s") e \(remainingSeconds) segundo\(remainingSeconds == 1 ? "" : "s")"
    }
}
