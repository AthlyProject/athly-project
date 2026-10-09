import Foundation

/// On-device mapping between HKWorkout.uuid and a prescribed Workout.id.
/// Populated after the server confirms a workout completion, or reconciled from a fresh plan read.
/// Persisted as a single JSON file in Application Support to stay iOS 16.1 compatible (no SwiftData).
final class RunWorkoutLinkStore: @unchecked Sendable {
    static let shared = RunWorkoutLinkStore()

    private let queue = DispatchQueue(label: "com.athly.runworkoutlinkstore", qos: .utility)
    private let fileURL: URL
    private lazy var persistence = SnapshotFile<[RunWorkoutLink]>(url: fileURL)
    private var cache: [String: RunWorkoutLink] = [:]

    init(fileURL: URL? = nil) {
        if let fileURL {
            self.fileURL = fileURL
            loadFromDisk()
            return
        }
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
            let existingSegmentation = cache[healthKitUUID.lowercased()].flatMap { existing in
                existing.athlyWorkoutId == athlyWorkoutId ? existing.workoutSegmentation : nil
            }
            cache[healthKitUUID.lowercased()] = RunWorkoutLink(
                healthKitUUID: healthKitUUID,
                athlyWorkoutId: athlyWorkoutId,
                workoutSegmentation: existingSegmentation
            )
            persistLocked()
        }
    }

    /// Torna um único HKWorkout autoritativo para o treino prescrito e remove vínculos antigos
    /// do mesmo treino (por exemplo, após criar uma cópia rica a partir de um FIT).
    func replaceLink(healthKitUUID: String, athlyWorkoutId: String) {
        queue.sync {
            let previousSegmentation = cache.values
                .first { $0.athlyWorkoutId == athlyWorkoutId }?
                .workoutSegmentation
            cache = cache.filter { key, value in
                value.athlyWorkoutId != athlyWorkoutId || key == healthKitUUID.lowercased()
            }
            cache[healthKitUUID.lowercased()] = RunWorkoutLink(
                healthKitUUID: healthKitUUID,
                athlyWorkoutId: athlyWorkoutId,
                workoutSegmentation: previousSegmentation
            )
            persistLocked()
        }
    }

    /// Remove todos os vínculos que apontam para um treino prescrito e devolve os UUIDs liberados.
    /// Usado ao desvincular a corrida de um treino concluído: sem isso a corrida continuaria
    /// filtrada por `allOrphanCandidates` e não voltaria a aparecer em "Concluir treino".
    @discardableResult
    func unlinkAll(athlyWorkoutId: String) -> [String] {
        queue.sync {
            let removed = cache.values
                .filter { $0.athlyWorkoutId == athlyWorkoutId }
                .map { $0.healthKitUUID }
            guard !removed.isEmpty else { return [] }
            cache = cache.filter { $0.value.athlyWorkoutId != athlyWorkoutId }
            persistLocked()
            return removed
        }
    }

    func storeSegmentation(_ result: WorkoutSegmentationResult, for healthKitUUID: String) {
        queue.sync {
            guard var link = cache[healthKitUUID.lowercased()] else { return }
            link.workoutSegmentation = result
            cache[healthKitUUID.lowercased()] = link
            persistLocked()
        }
    }

    func fetchLink(for healthKitUUID: String) -> RunWorkoutLink? {
        queue.sync { cache[healthKitUUID.lowercased()] }
    }

    func athlyWorkoutId(for healthKitUUID: String) -> String? {
        fetchLink(for: healthKitUUID)?.athlyWorkoutId
    }

    func healthKitUUID(forAthlyWorkoutId athlyWorkoutId: String) -> String? {
        queue.sync {
            cache.values.first { $0.athlyWorkoutId == athlyWorkoutId }?.healthKitUUID
        }
    }

    func allOrphanCandidates(healthKitUUIDs: [String]) -> [String] {
        queue.sync { healthKitUUIDs.filter { cache[$0.lowercased()] == nil } }
    }

    /// A retry may select the same run again. Only links to a different workout exclude it.
    func completionCandidates(healthKitUUIDs: [String], workoutId: String) -> [String] {
        queue.sync {
            healthKitUUIDs.filter { uuid in
                guard let link = cache[uuid.lowercased()] else { return true }
                return link.athlyWorkoutId == workoutId
            }
        }
    }

    /// Called only after a successful server read, never from a potentially stale disk cache.
    /// Removes links written by older app versions before completion was confirmed.
    func reconcileConfirmedWorkouts(_ workouts: [WorkoutModel]) {
        queue.sync {
            let byId = Dictionary(workouts.map { ($0.id, $0) }, uniquingKeysWith: { _, newest in newest })
            var reconciled = cache.filter { key, link in
                guard let workout = byId[link.athlyWorkoutId] else { return true }
                return (workout.status == .done || workout.status == .partial)
                    && workout.appleHealthWorkoutUUID?.lowercased() == key
            }
            for workout in workouts where workout.status == .done || workout.status == .partial {
                guard let uuid = workout.appleHealthWorkoutUUID else { continue }
                let key = uuid.lowercased()
                if reconciled[key]?.athlyWorkoutId == workout.id { continue }
                reconciled[key] = RunWorkoutLink(healthKitUUID: uuid, athlyWorkoutId: workout.id)
            }
            guard reconciled != cache else { return }
            cache = reconciled
            persistLocked()
        }
    }

    func flush() async throws {
        let file = queue.sync { persistence }
        try await file.flush()
    }

    // MARK: - Persistence

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let decoded = try? decoder.decode([RunWorkoutLink].self, from: data) {
            cache = Dictionary(decoded.map { ($0.healthKitUUID.lowercased(), $0) }, uniquingKeysWith: { _, last in last })
        }
    }

    /// Must be called from inside `queue.sync`.
    private func persistLocked() {
        persistence.save(Array(cache.values))
    }
}
