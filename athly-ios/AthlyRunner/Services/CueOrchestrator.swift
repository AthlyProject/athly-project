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
        let formatter = WorkoutSpeechFormatter()
        switch event {
        case .countdown3:
            haptic.fire(.countdown)
            audio.playCountdown()

        case .boundary(let next):
            haptic.fire(.boundary)
            audio.playBoundary()
            speech.announce(formatter.boundary(for: next), language: formatter.language, priority: .normal)

        case .setComplete:
            haptic.fire(.setComplete)
            audio.playSetComplete()
            speech.announce(formatter.setComplete, language: formatter.language, priority: .high)

        case .targetAlertReached(let alert):
            haptic.fire(.boundary)
            audio.playBoundary()
            speech.announce(formatter.targetReached(alert), language: formatter.language, priority: .high)
        }
    }

    func stopAll() {
        audio.stopAll()
        speech.stop()
        CueAudioSession.shared.forceDeactivate()
    }
}
