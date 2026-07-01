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
    private var currentUtteranceID: ObjectIdentifier?
    private var utteranceCueTokens: [ObjectIdentifier: UUID] = [:]

    private override init() {
        super.init()
        synthesizer.delegate = self
#if os(iOS)
        synthesizer.usesApplicationAudioSession = true
#endif
    }

    // MARK: - Public API

    func announce(_ phrase: String, priority: Priority = .normal) {
        guard !phrase.isEmpty else { return }
        if synthesizer.isSpeaking && priority < currentPriority { return }
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
            releaseAllCueTokens()
            currentUtteranceID = nil
        }

        guard let cueToken = CueAudioSession.shared.beginCue() else { return }

        currentPriority = priority
        let utterance = AVSpeechUtterance(string: phrase)
        utterance.voice = voice
        utterance.rate = 0.52
        utterance.pitchMultiplier = 1.0
        utterance.volume = 0.9
        let utteranceID = ObjectIdentifier(utterance)
        currentUtteranceID = utteranceID
        utteranceCueTokens[utteranceID] = cueToken
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        releaseAllCueTokens()
        currentUtteranceID = nil
        currentPriority = .low
    }

    private func finishUtterance(with utteranceID: ObjectIdentifier) {
        if let token = utteranceCueTokens.removeValue(forKey: utteranceID) {
            CueAudioSession.shared.endCue(token)
        }
        guard currentUtteranceID == utteranceID else { return }
        currentUtteranceID = nil
        currentPriority = .low
    }

    private func releaseAllCueTokens() {
        let tokens = Array(utteranceCueTokens.values)
        utteranceCueTokens.removeAll()
        for token in tokens {
            CueAudioSession.shared.endCue(token)
        }
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension SpeechService: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let utteranceID = ObjectIdentifier(utterance)
        Task { @MainActor in
            self.finishUtterance(with: utteranceID)
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let utteranceID = ObjectIdentifier(utterance)
        Task { @MainActor in
            self.finishUtterance(with: utteranceID)
        }
    }
}
