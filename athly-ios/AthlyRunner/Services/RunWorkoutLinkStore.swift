import Foundation

/// On-device mapping between HKWorkout.uuid and a prescribed Workout.id.
/// Populated automatically when the user starts a run from a workout card, or via manual match UX.
/// Persisted as a single JSON file in Application Support to stay iOS 16.1 compatible (no SwiftData).
final class RunWorkoutLinkStore: @unchecked Sendable {
    static let shared = RunWorkoutLinkStore()

    private let queue = DispatchQueue(label: "com.athly.runworkoutlinkstore", qos: .utility)
    private let fileURL: URL
    private var cache: [String: RunWorkoutLink] = [:]

    private init() {
        let fm = FileManager.default
        let base = (try? fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Athly", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        self.fileURL = dir.appendingPathComponent("run-workout-links.json")
        loadFromDisk()
    }

    func link(healthKitUUID: String, athlyWorkoutId: String) {
        queue.sync {
            cache[healthKitUUID] = RunWorkoutLink(
                healthKitUUID: healthKitUUID,
                athlyWorkoutId: athlyWorkoutId
            )
            persistLocked()
        }
    }

    func fetchLink(for healthKitUUID: String) -> RunWorkoutLink? {
        queue.sync { cache[healthKitUUID] }
    }

    func athlyWorkoutId(for healthKitUUID: String) -> String? {
        fetchLink(for: healthKitUUID)?.athlyWorkoutId
    }

    func allOrphanCandidates(healthKitUUIDs: [String]) -> [String] {
        queue.sync { healthKitUUIDs.filter { cache[$0] == nil } }
    }

    // MARK: - Persistence

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let decoded = try? decoder.decode([RunWorkoutLink].self, from: data) {
            cache = Dictionary(uniqueKeysWithValues: decoded.map { ($0.healthKitUUID, $0) })
        }
    }

    /// Must be called from inside `queue.sync`.
    private func persistLocked() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let snapshot = Array(cache.values)
        if let data = try? encoder.encode(snapshot) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
