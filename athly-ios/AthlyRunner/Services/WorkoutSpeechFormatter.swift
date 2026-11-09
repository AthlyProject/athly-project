import Foundation

/// The app's resolved localization, independent of the iPhone's regional settings.
enum WorkoutSpeechLanguage: String, CaseIterable {
    case portuguese = "pt-BR"
    case english = "en"
    case german = "de"

    init(identifier: String) {
        switch identifier.replacingOccurrences(of: "_", with: "-").lowercased().split(separator: "-").first {
        case "en": self = .english
        case "de": self = .german
        default: self = .portuguese
        }
    }

    static var current: Self {
        Self(identifier: Bundle.main.preferredLocalizations.first ?? "pt-BR")
    }

    var voiceLanguage: String {
        switch self {
        case .portuguese: "pt-BR"
        case .english: "en-US"
        case .german: "de-DE"
        }
    }

    /// Pure selection so fallback behavior can be tested without installed system voices.
    func voiceIdentifier(in voices: [(identifier: String, language: String)]) -> String? {
        return voices.first { $0.language == voiceLanguage }?.identifier
            ?? voices.first { Self.languageCode($0.language) == Self.languageCode(voiceLanguage) }?.identifier
    }

    private static func languageCode(_ identifier: String) -> String {
        String(identifier.replacingOccurrences(of: "_", with: "-").lowercased().split(separator: "-").first ?? "")
    }
}

/// Builds spoken text from structured workout data, never from potentially stale AI labels.
struct WorkoutSpeechFormatter {
    let language: WorkoutSpeechLanguage
    private let bundle: Bundle
    private var locale: Locale { Locale(identifier: language.voiceLanguage) }

    init(language: WorkoutSpeechLanguage = .current, bundle: Bundle = .main) {
        self.language = language
        if let path = bundle.path(forResource: language.rawValue, ofType: "lproj"),
           let localized = Bundle(path: path) {
            self.bundle = localized
        } else {
            self.bundle = bundle
        }
    }

    func boundary(for segment: ActiveSegment) -> String {
        let key = segment.kind == .set || segment.kind == .unknown ? "next" : segment.kind.rawValue
        var label = text("speech.block.\(key)")
        if let index = segment.setIndex, let total = segment.setTotal {
            label = text("speech.position", label, String(index), String(total))
        }
        let value: String
        switch segment.end.by {
        case .distanceM: value = distance(meters: segment.end.value)
        case .durationSec: value = duration(seconds: Int(segment.end.value))
        case .reps: value = quantity(Int(segment.end.value), unit: "repetition")
        }
        return text("speech.boundary", label, value)
    }

    var setComplete: String { text("speech.setComplete") }

    func targetReached(_ alert: RunTargetAlert) -> String {
        text("speech.targetReached", targetValue(alert))
    }

    func targetValue(_ alert: RunTargetAlert) -> String {
        switch alert.kind {
        case .distance: distance(meters: alert.value * 1000)
        case .time: duration(seconds: Int((alert.value * 60).rounded()))
        }
    }

    func distance(meters: Double) -> String {
        if meters < 1000 { return quantity(Int(meters.rounded()), unit: "meter") }
        let km = meters / 1000
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        let number = formatter.string(from: NSNumber(value: km)) ?? String(km)
        return text("speech.kilometer.\(km == 1 ? "one" : "other")", number)
    }

    func duration(seconds: Int) -> String {
        let minutes = seconds / 60
        let remainder = seconds % 60
        if minutes == 0 { return quantity(remainder, unit: "second") }
        if remainder == 0 { return quantity(minutes, unit: "minute") }
        return text("speech.durationCombined", quantity(minutes, unit: "minute"), quantity(remainder, unit: "second"))
    }

    private func quantity(_ value: Int, unit: String) -> String {
        text("speech.\(unit).\(value == 1 ? "one" : "other")", String(value))
    }

    private func text(_ key: String, _ arguments: String...) -> String {
        let template = bundle.localizedString(forKey: key, value: nil, table: "Localizable")
        return String(format: template, locale: locale, arguments: arguments)
    }
}
