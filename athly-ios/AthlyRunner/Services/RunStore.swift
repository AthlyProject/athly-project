import Foundation

@MainActor
final class RunStore: ObservableObject {
    @Published private(set) var sessions: [RunSession] = []

    private static let fileName = "run_sessions.json"

    init() {
        load()
    }

    // MARK: - Public API

    func add(_ session: RunSession) {
        sessions.insert(session, at: 0)
        save()
    }

    func update(_ session: RunSession) {
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
            save()
        }
    }

    func delete(_ session: RunSession) {
        sessions.removeAll { $0.id == session.id }
        save()
    }

    /// Idempotently persists an imported activity. Exact fingerprints win; a fuzzy match lets
    /// FIT/TCX/GPX exports of the same run enrich one another without duplicating history.
    @discardableResult
    func upsert(
        imported workout: ImportedWorkout,
        athlyWorkoutId: String?,
        segmentation: WorkoutSegmentationResult? = nil
    ) -> RunSession {
        let existing = sessions.first { session in
            if let linkedWorkoutId = session.athlyWorkoutId,
               let athlyWorkoutId,
               linkedWorkoutId != athlyWorkoutId {
                return false
            }
            if session.importFingerprint == workout.fingerprint { return true }
            return Self.matches(session: session, imported: workout)
        }

        let session = existing ?? RunSession(sportType: "running")
        session.startDate = workout.startDate
        session.endDate = workout.endDate
        session.distanceMeters = workout.distanceMeters
        session.durationSeconds = workout.activeDurationSeconds
        session.totalDurationSeconds = workout.totalDurationSeconds
        session.averagePaceSecondsPerKm = workout.averagePaceSecondsPerKm
        session.elevationGainMeters = workout.elevationGainMeters
        session.caloriesBurned = workout.caloriesBurned
        session.status = "completed"
        session.sportType = "running"
        session.athlyWorkoutId = athlyWorkoutId ?? session.athlyWorkoutId
        session.importFingerprint = workout.fingerprint
        session.importFormat = richerFormat(current: session.importFormat, candidate: workout.format)
        session.isIndoor = workout.isIndoor
        if let segmentation,
           shouldReplaceSegmentation(current: session.workoutSegmentation, candidate: segmentation) {
            session.segmentRecords = segmentation.segments
            session.workoutSegmentation = segmentation
        }

        if workout.route.count > session.routePoints.count {
            session.routePoints = workout.route.map(RoutePoint.init(location:))
            session.splits = workout.runResult.splits.map {
                Split(
                    kilometer: $0.kilometer,
                    durationSeconds: $0.durationSeconds,
                    distanceMeters: $0.distanceMeters,
                    elevationDelta: $0.elevationDelta
                )
            }
            session.pauseIntervals = workout.pauseIntervals
        }
        if workout.heartRateSamples.count > (session.importedHeartRateSamples?.count ?? 0) {
            session.importedHeartRateSamples = workout.heartRateSamples
        }
        if workout.laps.count > (session.importedLaps?.count ?? 0) {
            session.importedLaps = workout.laps
        }

        if existing == nil {
            sessions.insert(session, at: 0)
        }
        save()
        return session
    }

    func importedSession(for workoutId: String) -> RunSession? {
        sessions
            .filter { $0.athlyWorkoutId == workoutId && $0.status == "completed" }
            .sorted { $0.startDate > $1.startDate }
            .first
    }

    /// Sessions sorted by startDate descending (most recent first).
    var sortedSessions: [RunSession] {
        sessions.sorted { $0.startDate > $1.startDate }
    }

    private static func matches(session: RunSession, imported workout: ImportedWorkout) -> Bool {
        let startDelta = abs(session.startDate.timeIntervalSince(workout.startDate))
        let durationDelta = abs(session.durationSeconds - workout.activeDurationSeconds)
        let distanceDelta = abs(session.distanceMeters - workout.distanceMeters)
        let distanceTolerance = max(100, workout.distanceMeters * 0.03)
        return startDelta < 120 && durationDelta < 180 && distanceDelta <= distanceTolerance
    }

    private func richerFormat(current: WorkoutImportFormat?, candidate: WorkoutImportFormat) -> WorkoutImportFormat {
        guard let current else { return candidate }
        let rank: [WorkoutImportFormat: Int] = [.gpx: 0, .tcx: 1, .fit: 2]
        return (rank[candidate] ?? 0) > (rank[current] ?? 0) ? candidate : current
    }

    private func shouldReplaceSegmentation(
        current: WorkoutSegmentationResult?,
        candidate: WorkoutSegmentationResult
    ) -> Bool {
        guard let current else { return true }
        func rank(_ origin: WorkoutSegmentationOrigin) -> Int {
            switch origin {
            case .athlyTracker: return 4
            case .prescribedRoute: return 3
            case .thirdPartyLaps: return 2
            case .prescribedTime: return 1
            case .unavailable: return 0
            }
        }
        return rank(candidate.origin) >= rank(current.origin)
    }

    // MARK: - Persistence

    private static var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent(fileName)
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(sessions)
            try data.write(to: Self.fileURL, options: .atomic)
        } catch {
            print("[RunStore] Failed to save: \(error)")
        }
    }

    private func load() {
        let url = Self.fileURL
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        do {
            let data = try Data(contentsOf: url)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            sessions = try decoder.decode([RunSession].self, from: data)
        } catch {
            print("[RunStore] Failed to load: \(error)")
        }
    }
}
