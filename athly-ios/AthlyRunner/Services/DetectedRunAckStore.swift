import Foundation

/// Corridas do Apple Health que o atleta dispensou ("Ignorar esta atividade") na tela de
/// detecção automática. Sem isso a mesma corrida voltaria a ser oferecida a cada abertura.
///
/// Só o caminho "ignorar" precisa deste registro: vincular a um treino grava em
/// `RunWorkoutLinkStore`, e "corri por conta própria" grava uma `RunSession` com o
/// `healthKitWorkoutUUID` — ambos já filtrados por `DetectedRunService`.
///
/// Persistido como um único JSON em Application Support (sem SwiftData, iOS 16.1).
final class DetectedRunAckStore: @unchecked Sendable {
    static let shared = DetectedRunAckStore()

    /// Janela de retenção. Uma corrida fora da janela de detecção nunca mais é oferecida,
    /// então guardar o reconhecimento para sempre só faria o arquivo crescer.
    static let retention: TimeInterval = 30 * 24 * 3600

    private let queue = DispatchQueue(label: "com.athly.detectedrunackstore", qos: .utility)
    private let fileURL: URL
    private var cache: [String: Date] = [:]

    private init() {
        let fm = FileManager.default
        let base = (try? fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Athly", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        self.fileURL = dir.appendingPathComponent("detected-run-acks.json")
        loadFromDisk()
    }

    func acknowledge(healthKitUUID: String, at date: Date = Date()) {
        queue.sync {
            cache[healthKitUUID] = date
            persistLocked()
        }
    }

    func isAcknowledged(_ healthKitUUID: String) -> Bool {
        queue.sync { cache[healthKitUUID] != nil }
    }

    func acknowledgedUUIDs() -> Set<String> {
        queue.sync { Set(cache.keys) }
    }

    func clear() {
        queue.sync {
            cache = [:]
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    // MARK: - Persistence

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let decoded = try? decoder.decode([String: Date].self, from: data) else { return }
        let cutoff = Date().addingTimeInterval(-Self.retention)
        cache = decoded.filter { $0.value >= cutoff }
        if cache.count != decoded.count { persistLocked() }
    }

    /// Must be called from inside `queue.sync` (or from `init`, before any concurrent access).
    private func persistLocked() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(cache) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
