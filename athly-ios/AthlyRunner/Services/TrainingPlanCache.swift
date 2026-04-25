import Foundation

struct TrainingPlanCacheSnapshot: Codable {
    var trainingPlan: TrainingPlanResponse?
    var weeklyGoals: [WeeklyGoalResponse]
    var allWorkouts: [WorkoutModel]
    var todayWorkout: WorkoutModel?
    var lastAnalysis: RunAnalysis?
    var updatedAt: Date
}

final class TrainingPlanCache: @unchecked Sendable {
    static let shared = TrainingPlanCache()

    private let queue = DispatchQueue(label: "com.athly.trainingplancache", qos: .utility)
    private let fileURL: URL
    private var cached: TrainingPlanCacheSnapshot?

    private init() {
        let fm = FileManager.default
        let base = (try? fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true))
            ?? fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Athly", isDirectory: true)
        if !fm.fileExists(atPath: dir.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        self.fileURL = dir.appendingPathComponent("training-plan-cache.json")
        loadFromDisk()
    }

    func load() -> TrainingPlanCacheSnapshot? {
        queue.sync { cached }
    }

    func save(_ snapshot: TrainingPlanCacheSnapshot) {
        queue.sync {
            cached = snapshot
            persistLocked()
        }
    }

    func upsertWorkout(_ workout: WorkoutModel) {
        queue.sync {
            guard var snapshot = cached else { return }
            snapshot.allWorkouts = snapshot.allWorkouts.map { $0.id == workout.id ? workout : $0 }
            if snapshot.todayWorkout?.id == workout.id {
                snapshot.todayWorkout = workout
            }
            snapshot.updatedAt = Date()
            cached = snapshot
            persistLocked()
        }
    }

    func clear() {
        queue.sync {
            cached = nil
            try? FileManager.default.removeItem(at: fileURL)
        }
    }

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: fileURL) else { return }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        cached = try? decoder.decode(TrainingPlanCacheSnapshot.self, from: data)
    }

    private func persistLocked() {
        guard let snapshot = cached else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(snapshot) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}
