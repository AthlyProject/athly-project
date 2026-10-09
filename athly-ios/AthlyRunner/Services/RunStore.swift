import Foundation

@MainActor
final class RunStore: ObservableObject {
    @Published private(set) var sessions: [RunSession] = []
    @Published private(set) var revision = 0
    @Published private(set) var isLoaded = false
    @Published private(set) var persistenceError: String?
    private var sorted: [RunSession] = []
    private var loadTask: Task<Void, Never>?
    private var changedBeforeLoad = Set<UUID>()
    private var deletedBeforeLoad = Set<UUID>()
    private let file: SnapshotFile<[RunSessionSnapshot]>

    private static let fileName = "run_sessions.json"

    private let storageURL: URL

    init(fileURL: URL? = nil) {
        storageURL = fileURL ?? Self.fileURL
        file = SnapshotFile(url: storageURL)
    }

    // MARK: - Public API

    func add(_ session: RunSession) {
        changedBeforeLoad.insert(session.id)
        sessions.insert(session, at: 0)
        save()
    }

    func update(_ session: RunSession) {
        changedBeforeLoad.insert(session.id)
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
            save()
        }
    }

    func delete(_ session: RunSession) {
        deletedBeforeLoad.insert(session.id)
        sessions.removeAll { $0.id == session.id }
        save()
    }

    /// Solta as corridas locais de um treino prescrito sem removê-las do histórico.
    /// Usado ao desvincular a corrida de um treino concluído — `upsert` só consegue *setar*
    /// `athlyWorkoutId`, nunca limpá-lo.
    func detach(athlyWorkoutId: String) {
        let indices = sessions.indices.filter { sessions[$0].athlyWorkoutId == athlyWorkoutId }
        guard !indices.isEmpty else { return }
        for index in indices {
            let session = sessions[index]
            changedBeforeLoad.insert(session.id)
            session.athlyWorkoutId = nil
            sessions[index] = session // reatribui para disparar o @Published (RunSession é classe)
        }
        save()
    }

    /// Repair tentative associations from older app versions without deleting recorded runs.
    func reconcileConfirmedWorkouts(_ workouts: [WorkoutModel]) {
        let byId = Dictionary(workouts.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
        var changed = false
        for session in sessions {
            guard let id = session.athlyWorkoutId, let workout = byId[id],
                  workout.status != .done && workout.status != .partial else { continue }
            session.athlyWorkoutId = nil
            changedBeforeLoad.insert(session.id)
            changed = true
        }
        if changed { save() }

    }

    /// Idempotently persists an imported activity. Exact fingerprints win; a fuzzy match lets
    /// FIT/TCX/GPX exports of the same run enrich one another without duplicating history.
    @discardableResult
    func upsert(
        imported workout: ImportedWorkout,
        athlyWorkoutId: String?,
        healthSummary: HealthKitRunItem? = nil,
        segmentation: WorkoutSegmentationResult? = nil,
        confirmWorkoutLink: Bool = true,
        preparedResult: RunResult? = nil,
        preparedPoints: [RoutePoint]? = nil,
        preparedSplits: [Split]? = nil
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
        session.startDate = healthSummary?.startDate ?? workout.startDate
        session.endDate = healthSummary?.endDate ?? workout.endDate
        session.distanceMeters = healthSummary?.distanceMeters ?? workout.distanceMeters
        session.durationSeconds = healthSummary?.durationSeconds ?? workout.activeDurationSeconds
        session.totalDurationSeconds = workout.totalDurationSeconds
        session.averagePaceSecondsPerKm = healthSummary?.averagePaceSecondsPerKm ?? workout.averagePaceSecondsPerKm
        session.elevationGainMeters = healthSummary?.elevationGainMeters ?? workout.elevationGainMeters
        let healthCalories = healthSummary?.activeEnergyBurned ?? 0
        session.caloriesBurned = healthCalories > 0 ? healthCalories : workout.caloriesBurned
        session.status = "completed"
        session.sportType = "running"
        if confirmWorkoutLink { session.athlyWorkoutId = athlyWorkoutId ?? session.athlyWorkoutId }
        session.importFingerprint = workout.fingerprint
        session.importFormat = richerFormat(current: session.importFormat, candidate: workout.format)
        session.isIndoor = workout.isIndoor
        if let segmentation,
           shouldReplaceSegmentation(current: session.workoutSegmentation, candidate: segmentation) {
            session.segmentRecords = segmentation.segments
            session.workoutSegmentation = segmentation
        }

        if workout.route.count > session.routePoints.count {
            session.routePoints = preparedPoints ?? workout.route.map(RoutePoint.init(location:))
            session.splits = preparedSplits ?? (preparedResult ?? workout.runResult).splits.map {
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
        changedBeforeLoad.insert(session.id)
        save()
        return session
    }

    /// Idempotently persists a run that already exists in Apple Health but was **not** started
    /// by Athly ("corri por conta própria" na detecção automática). Reaproveita uma sessão
    /// equivalente quando houver, para que reabrir o app não duplique o histórico.
    ///
    /// Não escreve nada de volta no Apple Health: a corrida já está lá, por isso
    /// `healthKitSyncStatus = .synced`.
    @discardableResult
    func upsert(healthRun run: HealthKitRunItem, detail: RunRouteDetail?) -> RunSession {
        let existing = sessions.first { session in
            if let uuid = session.healthKitWorkoutUUID { return uuid == run.id }
            return HealthKitRunMatch.matches(session: session, run: run)
        }

        let session = existing ?? RunSession(sportType: "running")
        session.startDate = run.startDate
        session.endDate = run.endDate
        session.distanceMeters = run.distanceMeters
        session.durationSeconds = run.durationSeconds
        session.averagePaceSecondsPerKm = run.averagePaceSecondsPerKm
        session.elevationGainMeters = run.elevationGainMeters ?? session.elevationGainMeters
        session.caloriesBurned = run.activeEnergyBurned
        session.status = "completed"
        session.sportType = "running"
        session.healthKitWorkoutUUID = run.id
        session.healthKitSyncStatus = .synced
        session.healthKitSyncError = nil

        if let detail {
            let points = detail.coordinates.map {
                RoutePoint(latitude: $0.latitude, longitude: $0.longitude, altitude: 0, timestamp: run.startDate)
            }
            if points.count > session.routePoints.count {
                session.routePoints = points
            }
            if detail.splits.count > session.splits.count {
                session.splits = detail.splits.map {
                    Split(
                        kilometer: $0.kilometer,
                        durationSeconds: $0.durationSeconds,
                        distanceMeters: $0.distanceMeters,
                        elevationDelta: $0.elevationDelta
                    )
                }
            }
            if detail.segmentRecords.count > (session.segmentRecords?.count ?? 0) {
                session.segmentRecords = detail.segmentRecords
            }
        }

        if existing == nil {
            sessions.insert(session, at: 0)
        } else {
            // RunSession é classe: reatribui para disparar o @Published.
            if let index = sessions.firstIndex(where: { $0.id == session.id }) {
                sessions[index] = session
            }
        }
        changedBeforeLoad.insert(session.id)
        save()
        return session
    }

    func session(forImportedFingerprint fingerprint: String, workoutId: String) -> RunSession? {
        sessions.first { $0.importFingerprint == fingerprint && ($0.athlyWorkoutId == nil || $0.athlyWorkoutId == workoutId) }
    }

    func importedSession(for workoutId: String) -> RunSession? {
        sessions
            .filter { $0.athlyWorkoutId == workoutId && $0.status == "completed" }
            .sorted { $0.startDate > $1.startDate }
            .first
    }

    /// Sessions sorted by startDate descending (most recent first).
    var sortedSessions: [RunSession] {
        sorted
    }

    private static func matches(session: RunSession, imported workout: ImportedWorkout) -> Bool {
        let startDelta = abs(session.startDate.timeIntervalSince(workout.startDate))
        let durationDelta = abs(session.durationSeconds - workout.activeDurationSeconds)
        let distanceDelta = abs(session.distanceMeters - workout.distanceMeters)
        let distanceTolerance = max(100, workout.distanceMeters * 0.03)
        return startDelta <= 120 && durationDelta <= 180 && distanceDelta <= distanceTolerance
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
        sorted = sessions.sorted { $0.startDate > $1.startDate }
        revision += 1
        guard isLoaded else { return }
        file.save(sessions.map(RunSessionSnapshot.init))
    }

    func loadIfNeeded() async {
        if let loadTask { await loadTask.value; return }
        guard !isLoaded else { return }
        let task = Task {
            do {
                let snapshots = try await file.load() ?? []
                let existing = Set(sessions.map(\.id)).union(deletedBeforeLoad)
                sessions.append(contentsOf: snapshots.filter { !existing.contains($0.id) }.map { $0.restore() })
                isLoaded = true
                sorted = sessions.sorted { $0.startDate > $1.startDate }
                revision += 1
                if !changedBeforeLoad.isEmpty || !deletedBeforeLoad.isEmpty { save() }
                changedBeforeLoad.removeAll()
                deletedBeforeLoad.removeAll()
                persistenceError = nil
            } catch {
                // Never overwrite an unreadable history with an empty/partial in-memory list.
                persistenceError = error.localizedDescription
            }
        }
        loadTask = task
        await task.value
        loadTask = nil
    }

    func flush() async throws {
        await loadIfNeeded()
        guard isLoaded else { throw CocoaError(.fileReadUnknown) }
        do {
            try await file.flush()
            persistenceError = nil
        } catch {
            persistenceError = error.localizedDescription
            throw error
        }
    }
}
