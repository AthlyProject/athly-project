import AVFoundation
import Foundation

/// Plays short pre-synthesised tones for workout segment transitions.
/// Ducks competing audio (Spotify/podcasts) briefly on each cue.
@MainActor
final class AudioCueService {

    static let shared = AudioCueService()

    private var players: [CueSound: AVAudioPlayer] = [:]

    enum CueSound {
        /// Three short descending tones — "3-2-1" countdown before boundary.
        case countdown
        /// Single sharp beep — segment has started / boundary crossed.
        case boundary
        /// Two-tone success sound — full set completed.
        case setComplete
    }

    private init() {
        configureSession()
        preloadPlayers()
    }

    // MARK: - Public API

    func playCountdown() { play(.countdown) }
    func playBoundary() { play(.boundary) }
    func playSetComplete() { play(.setComplete) }

    // MARK: - Private

    private func configureSession() {
#if os(iOS)
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playback,
                mode: .voicePrompt,
                options: [.duckOthers, .allowBluetooth, .allowBluetoothA2DP]
            )
            try session.setActive(true)
        } catch {
            // Non-fatal: cues silently fail but the workout continues.
        }
#endif
    }

    private func preloadPlayers() {
        let cueMap: [(CueSound, String)] = [
            (.countdown, "cue_countdown"),
            (.boundary, "cue_boundary"),
            (.setComplete, "cue_set_complete"),
        ]
        for (sound, name) in cueMap {
            guard let url = Bundle.main.url(forResource: name, withExtension: "wav") else { continue }
            if let player = try? AVAudioPlayer(contentsOf: url) {
                player.prepareToPlay()
                players[sound] = player
            }
        }
    }

    private func play(_ sound: CueSound) {
        guard let player = players[sound] else { return }
        if player.isPlaying { player.stop() }
        player.currentTime = 0
        player.play()
    }
}
