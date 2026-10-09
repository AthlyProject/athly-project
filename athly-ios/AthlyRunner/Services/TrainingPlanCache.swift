import Foundation
import OSLog

/// Memory access never waits for disk. All disk operations are ordered on a separate queue.
/// Newer snapshots supersede queued writes; clear participates in that same ordering.
final class SnapshotFile<Value: Codable & Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private let queue = DispatchQueue(label: "com.athly.snapshot-file", qos: .utility)
    private let url: URL
    private var cached: Value?
    private var initialized = false
    private var revision = 0
    private var barriers: [Int: Int] = [:]
    // Accessed only by the disk queue.
    private var writeError: Error?

    init(url: URL) { self.url = url }

    static func applicationURL(_ name: String) -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Athly", isDirectory: true).appendingPathComponent(name)
    }

    func value() -> Value? { lock.withLock { cached } }

    func load() async throws -> Value? {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                let interval = PerformanceTrace.signposter.beginInterval("CacheRead")
                defer { PerformanceTrace.signposter.endInterval("CacheRead", interval) }
                do {
                    if self.lock.withLock({ self.initialized }) {
                        continuation.resume(returning: self.value())
                        return
                    }
                    let value: Value?
                    if FileManager.default.fileExists(atPath: self.url.path) {
                        let decoder = JSONDecoder()
                        decoder.dateDecodingStrategy = .iso8601
                        value = try decoder.decode(Value.self, from: Data(contentsOf: self.url))
                    } else { value = nil }
                    let result = self.lock.withLock {
                        if !self.initialized { self.cached = value; self.initialized = true }
                        return self.cached
                    }
                    continuation.resume(returning: result)
                } catch { continuation.resume(throwing: error) }
            }
        }
    }

    func save(_ value: Value) { enqueue(value) }
    func clear() { enqueue(nil) }

    private func enqueue(_ value: Value?) {
        lock.withLock {
            cached = value
            initialized = true
            revision += 1
            let version = revision
            queue.async {
                guard self.lock.withLock({ self.revision == version || self.barriers[version] != nil }) else { return }
                let interval = PerformanceTrace.signposter.beginInterval("CacheWrite")
                defer { PerformanceTrace.signposter.endInterval("CacheWrite", interval) }
                do {
                    if let value {
                        let encoder = JSONEncoder()
                        encoder.dateEncodingStrategy = .iso8601
                        let data = try encoder.encode(value)
                        try FileManager.default.createDirectory(at: self.url.deletingLastPathComponent(), withIntermediateDirectories: true)
                        try data.write(to: self.url, options: .atomic)
                    } else if FileManager.default.fileExists(atPath: self.url.path) {
                        try FileManager.default.removeItem(at: self.url)
                    }
                    self.writeError = nil
                } catch { self.writeError = error }
            }
        }
    }

    /// Wait for writes submitted before this call, without blocking the caller's executor.
    func flush() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            lock.withLock {
                let version = revision
                barriers[version, default: 0] += 1
                queue.async {
                    self.lock.withLock {
                        if self.barriers[version] == 1 { self.barriers[version] = nil }
                        else { self.barriers[version, default: 1] -= 1 }
                    }
                    if let error = self.writeError { continuation.resume(throwing: error) }
                    else { continuation.resume() }
                }
            }
        }
    }

}

struct TrainingPlanCacheSnapshot: Codable, Sendable {
    var trainingPlan: TrainingPlanResponse?
    var weeklyGoals: [WeeklyGoalResponse]
    var allWorkouts: [WorkoutModel]
    var todayWorkout: WorkoutModel?
    var lastAnalysis: RunAnalysis?
    var updatedAt: Date
}

final class TrainingPlanCache: Sendable {
    static let shared = TrainingPlanCache()
    private let file = SnapshotFile<TrainingPlanCacheSnapshot>(url: SnapshotFile<TrainingPlanCacheSnapshot>.applicationURL("training-plan-cache.json"))

    /// Synchronous access is memory-only. Startup hydration uses loadFromDisk().
    func load() -> TrainingPlanCacheSnapshot? { file.value() }
    func loadFromDisk() async -> TrainingPlanCacheSnapshot? { try? await file.load() }
    func save(_ snapshot: TrainingPlanCacheSnapshot) { file.save(snapshot) }
    func clear() { file.clear() }
}

struct HealthKitRunsCacheSnapshot: Codable, Sendable {
    var runs: [HealthKitRunItem]
    var linkedRunsById: [String: HealthKitRunItem]
    var updatedAt: Date
}

protocol HealthKitRunsCaching: AnyObject, Sendable {
    func load() -> HealthKitRunsCacheSnapshot?
    func loadFromDisk() async -> HealthKitRunsCacheSnapshot?
    func save(_ snapshot: HealthKitRunsCacheSnapshot)
    func clear()
}

extension HealthKitRunsCaching {
    func loadFromDisk() async -> HealthKitRunsCacheSnapshot? { load() }
}

final class HealthKitRunsCache: HealthKitRunsCaching, Sendable {
    static let shared = HealthKitRunsCache()
    private let file = SnapshotFile<HealthKitRunsCacheSnapshot>(url: SnapshotFile<HealthKitRunsCacheSnapshot>.applicationURL("healthkit-runs-cache.json"))
    func load() -> HealthKitRunsCacheSnapshot? { file.value() }
    func loadFromDisk() async -> HealthKitRunsCacheSnapshot? { try? await file.load() }
    func save(_ snapshot: HealthKitRunsCacheSnapshot) { file.save(snapshot) }
    func clear() { file.clear() }
}

/// Local Instruments intervals; no network exporter or health/user payloads.
enum PerformanceTrace {
    static let signposter = OSSignposter(subsystem: "com.athly.runner", category: "Performance")
}

/// Small legacy indexes have synchronous getters. Initialize them once on a worker before any UI reads.
enum LocalStoresBootstrap {
    private static let task = Task.detached(priority: .utility) {
        _ = RunWorkoutLinkStore.shared
        _ = AchievementStore.shared
        _ = DetectedRunAckStore.shared
    }
    static func prepare() async { await task.value }
}
