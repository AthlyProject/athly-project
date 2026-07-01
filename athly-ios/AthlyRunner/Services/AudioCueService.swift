import AVFoundation
import Foundation

/// Plays short pre-synthesised tones for workout segment transitions.
/// Ducks competing audio (Spotify/podcasts) briefly on each cue.
@MainActor
final class AudioCueService: NSObject {

    static let shared = AudioCueService()

    private var players: [CueSound: AVAudioPlayer] = [:]
    private var playerCueTokens: [ObjectIdentifier: UUID] = [:]

    enum CueSound {
        /// Three short descending tones — "3-2-1" countdown before boundary.
        case countdown
        /// Single sharp beep — segment has started / boundary crossed.
        case boundary
        /// Two-tone success sound — full set completed.
        case setComplete
    }

    private override init() {
        super.init()
        preloadPlayers()
    }

    // MARK: - Public API

    func playCountdown() { play(.countdown) }
    func playBoundary() { play(.boundary) }
    func playSetComplete() { play(.setComplete) }

    func stopAll() {
        for player in players.values {
            let playerID = ObjectIdentifier(player)
            if player.isPlaying { player.stop() }
            finishPlayer(with: playerID)
        }
    }

    // MARK: - Private

    private func preloadPlayers() {
        let cueMap: [(CueSound, String)] = [
            (.countdown, "cue_countdown"),
            (.boundary, "cue_boundary"),
            (.setComplete, "cue_set_complete"),
        ]
        for (sound, name) in cueMap {
            guard let url = Bundle.main.url(forResource: name, withExtension: "wav") else { continue }
            if let player = try? AVAudioPlayer(contentsOf: url) {
                player.delegate = self
                player.prepareToPlay()
                players[sound] = player
            }
        }
    }

    private func play(_ sound: CueSound) {
        guard let player = players[sound] else { return }
        let playerID = ObjectIdentifier(player)
        if player.isPlaying { player.stop() }
        finishPlayer(with: playerID)

        guard let cueToken = CueAudioSession.shared.beginCue() else { return }
        playerCueTokens[playerID] = cueToken
        player.currentTime = 0
        if !player.play() {
            finishPlayer(with: playerID)
        }
    }

    private func finishPlayer(with playerID: ObjectIdentifier) {
        guard let token = playerCueTokens.removeValue(forKey: playerID) else { return }
        CueAudioSession.shared.endCue(token)
    }
}

// MARK: - AVAudioPlayerDelegate

extension AudioCueService: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        let playerID = ObjectIdentifier(player)
        Task { @MainActor in
            self.finishPlayer(with: playerID)
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        let playerID = ObjectIdentifier(player)
        Task { @MainActor in
            self.finishPlayer(with: playerID)
        }
    }
}

// MARK: - Shared cue audio session

@MainActor
final class CueAudioSession {
    static let shared = CueAudioSession()

    private var activeCueTokens: Set<UUID> = []

    private init() {}

    func beginCue() -> UUID? {
#if os(iOS)
        let session = AVAudioSession.sharedInstance()
        let token = UUID()
        do {
            try session.setCategory(
                .playback,
                mode: .voicePrompt,
                options: [.mixWithOthers, .duckOthers]
            )
            try session.setActive(true)
            activeCueTokens.insert(token)
            return token
        } catch {
            return nil
        }
#else
        return UUID()
#endif
    }

    func endCue(_ token: UUID) {
        activeCueTokens.remove(token)
        deactivateIfIdle()
    }

    func forceDeactivate() {
        activeCueTokens.removeAll()
        deactivate()
    }

    private func deactivateIfIdle() {
        guard activeCueTokens.isEmpty else { return }
        deactivate()
    }

    private func deactivate() {
#if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
#endif
    }
}
