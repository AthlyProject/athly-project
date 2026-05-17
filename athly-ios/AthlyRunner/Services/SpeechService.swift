import AVFoundation
import Foundation

/// Text-to-speech announcements in pt-BR, serialised through a single queue
/// so phrases never overlap. Supports priority interruption (e.g. boundary
/// cue replaces a lower-priority in-flight phrase).
@MainActor
final class SpeechService: NSObject {

    static let shared = SpeechService()

    enum Priority: Int, Comparable {
        case low = 0      // informational ("400 metros concluídos")
        case normal = 1   // segment labels ("Aquecimento")
        case high = 2     // set completions, countdown

        static func < (lhs: Priority, rhs: Priority) -> Bool { lhs.rawValue < rhs.rawValue }
    }

    private let synthesizer = AVSpeechSynthesizer()
    private let voice: AVSpeechSynthesisVoice? = AVSpeechSynthesisVoice(language: "pt-BR")
    private var currentPriority: Priority = .low

    private override init() {
        super.init()
        synthesizer.delegate = self
    }

    // MARK: - Public API

    func announce(_ phrase: String, priority: Priority = .normal) {
        guard !phrase.isEmpty else { return }
        if synthesizer.isSpeaking && priority < currentPriority { return }
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }

        currentPriority = priority
        let utterance = AVSpeechUtterance(string: phrase)
        utterance.voice = voice
        utterance.rate = 0.52
        utterance.pitchMultiplier = 1.0
        utterance.volume = 0.9
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension SpeechService: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.currentPriority = .low
        }
    }
}
