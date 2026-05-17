import CoreHaptics
import UIKit

/// Haptic feedback for workout segment transitions.
/// Uses CHHapticEngine (custom patterns) where available;
/// falls back to UIImpactFeedbackGenerator on older devices.
@MainActor
final class HapticService {

    static let shared = HapticService()

    private var engine: CHHapticEngine?
    private let fallback = UIImpactFeedbackGenerator(style: .heavy)

    enum HapticPattern {
        /// Triple light tap — 3-2-1 countdown.
        case countdown
        /// Single sharp pulse — segment boundary crossed.
        case boundary
        /// Continuous success rumble — full set completed.
        case setComplete
    }

    private init() {
        prepareEngine()
        fallback.prepare()
    }

    // MARK: - Public API

    func fire(_ pattern: HapticPattern) {
        if engine != nil {
            playCustom(pattern)
        } else {
            playFallback(pattern)
        }
    }

    // MARK: - Private

    private func prepareEngine() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let e = try CHHapticEngine()
            e.resetHandler = { [weak self] in self?.prepareEngine() }
            e.stoppedHandler = { _ in }
            try e.start()
            engine = e
        } catch {
            engine = nil
        }
    }

    private func playCustom(_ pattern: HapticPattern) {
        guard let engine else { return }
        do {
            let events = hapticEvents(for: pattern)
            let p = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: p)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            playFallback(pattern)
        }
    }

    private func hapticEvents(for pattern: HapticPattern) -> [CHHapticEvent] {
        switch pattern {
        case .countdown:
            // Three light taps, 120ms apart
            return (0..<3).map { i in
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8),
                    ],
                    relativeTime: Double(i) * 0.12
                )
            }
        case .boundary:
            // One sharp single tap
            return [CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0),
                ],
                relativeTime: 0
            )]
        case .setComplete:
            // Continuous success rumble for 0.4s
            return [CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.4),
                ],
                relativeTime: 0,
                duration: 0.4
            )]
        }
    }

    private func playFallback(_ pattern: HapticPattern) {
        switch pattern {
        case .countdown:
            for i in 0..<3 {
                DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.12) {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                }
            }
        case .boundary:
            fallback.impactOccurred(intensity: 1.0)
        case .setComplete:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}
