import Foundation

struct HeartRateZones: Decodable, Sendable, Equatable {
    let status: String
    let method: String
    let isEstimated: Bool
    let missingData: [String]
    let restingHeartRate: Value?
    let maxHeartRate: Value?
    let zones: [Zone]
    var trainingGuidance: TrainingGuidance? = nil

    var shouldShowInProfile: Bool {
        status == "available" && trainingGuidance?.mode == "heart_rate_and_rpe"
    }

    struct TrainingGuidance: Decodable, Sendable, Equatable {
        let mode: String
        let reason: String
        let lastHeartRateRunAt: String?
    }

    struct Value: Decodable, Sendable, Equatable {
        let bpm: Int
        let source: String
        let measuredAt: String?

        var sourceLabel: String {
            switch source {
            case "manual": return String(localized: "Informado por você")
            case "apple_health": return "Apple Health"
            case "age_estimate": return String(localized: "Estimado pela idade")
            default: return String(localized: "Origem indisponível")
            }
        }

        var measurementDate: Date? {
            guard let measuredAt else { return nil }
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return iso.date(from: measuredAt) ?? ISO8601DateFormatter().date(from: measuredAt)
        }
    }

    struct Zone: Decodable, Sendable, Equatable, Identifiable {
        let zone: Int
        let minBpm: Int
        let maxBpm: Int
        var id: Int { zone }

        var intensity: String {
            switch zone {
            case 1: return String(localized: "Muito leve")
            case 2: return String(localized: "Leve")
            case 3: return String(localized: "Moderada")
            case 4: return String(localized: "Intensa")
            default: return String(localized: "Muito intensa")
            }
        }
    }
}

struct HeartRateHealthSnapshot: Sendable, Equatable {
    let restingHeartRate: Int
    let measuredAt: Date
    let capturedAt: Date
}

struct HeartRateHealthRequest: Encodable, Sendable {
    let restingHeartRate: Int
    let measuredAt: String
    let capturedAt: String

    init(_ snapshot: HeartRateHealthSnapshot) {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        restingHeartRate = snapshot.restingHeartRate
        measuredAt = iso.string(from: snapshot.measuredAt)
        capturedAt = iso.string(from: snapshot.capturedAt)
    }
}

protocol HeartRateHealthProviding: Sendable {
    func requestHeartRateReadAuthorization() async throws
    func fetchRestingHeartRate() async throws -> HeartRateHealthSnapshot?
}

/// Reused by generation and background sync, independently of the profile screen.
enum HeartRateHealthSync {
    @discardableResult
    static func sync(api: APIClient, health: any HeartRateHealthProviding, session: UUID) async throws -> HeartRateZones? {
        guard let snapshot = try await health.fetchRestingHeartRate() else { return nil }
        try Task.checkCancellation()
        return try await api.syncHeartRateHealth(snapshot, session: session)
    }
}

/// A recorded exercise peak, not an automatically calibrated physiological maximum.
struct ObservedHeartRatePeak: Sendable, Equatable {
    let value: Double
    let measuredAt: Date
    let sourceName: String
    let workoutID: UUID
    let sampleID: UUID
    let activity: UInt
    var bpm: Int { Int(value.rounded()) }
    var canUse: Bool { (100...240).contains(bpm) }

    static func select(_ candidates: [Self], now: Date) -> Self? {
        let cutoff = now.addingTimeInterval(-90 * 24 * 60 * 60)
        return candidates.filter {
            $0.value.isFinite && (30...240).contains($0.value) && $0.measuredAt >= cutoff && $0.measuredAt <= now
        }.max {
            if $0.value != $1.value { return $0.value < $1.value }
            if $0.measuredAt != $1.measuredAt { return $0.measuredAt < $1.measuredAt }
            return $0.sampleID.uuidString < $1.sampleID.uuidString
        }
    }
}

protocol ObservedHeartRatePeakProviding: Sendable {
    func fetchObservedHeartRatePeak() async throws -> ObservedHeartRatePeak?
}

/// Concurrent views share work, but no health results persist across reads or accounts.
actor ObservedHeartRatePeakPool {
    static let shared = ObservedHeartRatePeakPool()
    private var pending: Task<ObservedHeartRatePeak?, Error>?
    private var waiters = Set<UUID>()
    private var generation = UUID()

    func cancel() {
        generation = UUID()
        pending?.cancel()
        pending = nil
        waiters.removeAll()
    }
    private func release(_ waiter: UUID, generation expected: UUID) {
        guard generation == expected else { return }
        waiters.remove(waiter)
        if waiters.isEmpty { cancel() }
    }
    func read() async throws -> ObservedHeartRatePeak? {
        try Task.checkCancellation()
        if pending == nil { pending = Task { try await HealthKitService().fetchObservedHeartRatePeak() } }
        let task = pending!
        let waiter = UUID()
        let expected = generation
        waiters.insert(waiter)
        defer { release(waiter, generation: expected) }
        return try await withTaskCancellationHandler {
            let result = try await task.value
            try Task.checkCancellation()
            guard generation == expected else { throw CancellationError() }
            return result
        } onCancel: {
            Task { await self.release(waiter, generation: expected) }
        }
    }
}

struct WorkoutHeartRateSuggestion: Sendable, Equatable {
    let workoutID: String
    let bpm: Int
    let measuredAt: Date
    let previousMaximum: Int?

    static func make(workoutID: String, value: Double?, date: Date?, current: Int?, now: Date = Date()) -> Self? {
        guard let value, value.isFinite, (100...240).contains(value),
              let date, date <= now, date >= now.addingTimeInterval(-90 * 86400) else { return nil }
        let bpm = Int(value.rounded())
        if let current, bpm <= current { return nil }
        return Self(workoutID: workoutID, bpm: bpm, measuredAt: date, previousMaximum: current)
    }
}

enum HeartRatePeakActionState: Equatable {
    case available, inUse, selected, higherConfigured
    static func resolve(peak: Int, saved: Int?, draft: Int?, editing: Bool) -> Self {
        if editing, draft == peak, saved != peak { return .selected }
        if saved == peak, !editing || draft == peak { return .inUse }
        if let current = editing ? draft : saved, current > peak { return .higherConfigured }
        return .available
    }
}

extension Notification.Name {
    static let athlyHeartRateChanged = Notification.Name("athlyHeartRateChanged")
}
