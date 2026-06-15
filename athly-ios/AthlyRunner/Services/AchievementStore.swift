import Foundation

/// Conquistas do atleta: IDs de treinos de tentativa de objetivo (`isGoalAttempt`) em que a meta
/// planejada foi atingida, validados sem I.A. ao fim de cada treino (ver `WorkoutObjectiveValidator`).
/// Persistido como um único JSON em Application Support para manter compat. iOS 16.1 (sem SwiftData).
/// `Set` garante idempotência: concluir/recompletar o mesmo treino não conta em dobro.
final class AchievementStore: @unchecked Sendable {
    static let shared = AchievementStore()

    private let queue = DispatchQueue(label: "com.athly.achievementstore", qos: .utility)
    private let fileURL: URL
    private var achievedWorkoutIds: Set<String> = []

    private init() {
        let fm = FileManager.default
        let base = (try? fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Athly", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        self.fileURL = dir.appendingPathComponent("achievements.json")
        loadFromDisk()
    }

    /// Registra uma conquista. Idempotente — não persiste de novo se o treino já estava registrado.
    func record(workoutId: String) {
        queue.sync {
            guard achievedWorkoutIds.insert(workoutId).inserted else { return }
            persistLocked()
        }
    }

    var count: Int {
        queue.sync { achievedWorkoutIds.count }
    }

    func contains(workoutId: String) -> Bool {
        queue.sync { achievedWorkoutIds.contains(workoutId) }
    }

    func clear() {
        queue.sync {
            achievedWorkoutIds = []
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    // MARK: - Persistence

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        if let decoded = try? JSONDecoder().decode([String].self, from: data) {
            achievedWorkoutIds = Set(decoded)
        }
    }

    /// Must be called from inside `queue.sync`.
    private func persistLocked() {
        if let data = try? JSONEncoder().encode(Array(achievedWorkoutIds)) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
