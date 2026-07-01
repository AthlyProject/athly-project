import Foundation

/// Single entry point for all workout transition cues.
/// Callers fire one event; the orchestrator decides the haptic pattern,
/// beep type, and TTS phrase to sequence — nothing else coordinates the three services.
@MainActor
final class CueOrchestrator {

    static let shared = CueOrchestrator()

    private let audio = AudioCueService.shared
    private let speech = SpeechService.shared
    private let haptic = HapticService.shared

    enum Event {
        /// Fired ~3 s before the current segment ends.
        case countdown3
        /// Fired when crossing into a new segment.
        case boundary(to: ActiveSegment)
        /// Fired when the last repetition of a set finishes.
        case setComplete(setLabel: String, setsTotal: Int)
        /// Fired when a user-configured distance/time alert is reached.
        case targetAlertReached(RunTargetAlert)
    }

    private init() {}

    // MARK: - Public API

    func fire(_ event: Event) {
        switch event {
        case .countdown3:
            haptic.fire(.countdown)
            audio.playCountdown()

        case .boundary(let next):
            haptic.fire(.boundary)
            audio.playBoundary()
            speech.announce(ttsPhrase(for: next), priority: .normal)

        case .setComplete(let label, let total):
            haptic.fire(.setComplete)
            audio.playSetComplete()
            let phrase = total > 1 ? "\(label) concluído" : "Série concluída"
            speech.announce(phrase, priority: .high)

        case .targetAlertReached(let alert):
            haptic.fire(.boundary)
            audio.playBoundary()
            speech.announce("Ponto de retorno alcançado, \(alert.spokenValue).", priority: .high)
        }
    }

    func stopAll() {
        audio.stopAll()
        speech.stop()
        CueAudioSession.shared.forceDeactivate()
    }

    // MARK: - Private

    private func ttsPhrase(for segment: ActiveSegment) -> String {
        var parts: [String] = []

        // Set position badge — "Tiro 3 de 6"
        if let idx = segment.setIndex, let total = segment.setTotal {
            parts.append("\(kindLabel(segment.kind)) \(idx) de \(total)")
        } else {
            parts.append(kindLabel(segment.kind))
        }

        // Duration or distance cue
        switch segment.end.by {
        case .distanceM:
            let meters = Int(segment.end.value)
            if meters >= 1000 {
                let km = String(format: "%.1f", Double(meters) / 1000.0)
                parts.append("\(km) quilômetros")
            } else {
                parts.append("\(meters) metros")
            }
        case .durationSec:
            let secs = Int(segment.end.value)
            if secs >= 60 {
                let m = secs / 60
                let s = secs % 60
                parts.append(s == 0 ? "\(m) minuto\(m > 1 ? "s" : "")" : "\(m):\(String(format: "%02d", s))")
            } else {
                parts.append("\(secs) segundos")
            }
        case .reps:
            parts.append("\(Int(segment.end.value)) repetições")
        }

        return parts.joined(separator: ", ")
    }

    private func kindLabel(_ kind: SegmentKind) -> String {
        switch kind {
        case .warmup:   return "Aquecimento"
        case .work:     return "Tiro"
        case .recovery: return "Recuperação"
        case .cooldown: return "Desaceleramento"
        case .rest:     return "Descanso"
        case .set, .unknown: return "Próximo bloco"
        }
    }
}
