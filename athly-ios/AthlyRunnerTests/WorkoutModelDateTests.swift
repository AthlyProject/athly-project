import XCTest
import HealthKit
@testable import AthlyRunner

final class WorkoutModelDateTests: XCTestCase {

    @MainActor
    func testResumeCoalescesForegroundAndLoginAndRequiresExplicitRetry() async {
        var uploads = 0
        var requests: [Bool] = []
        var finishUpload: CheckedContinuation<Void, Never>?
        let failed = AiPlannerGenerationStatusResponse(generationId: "resume-job", status: "failed", pollAfterSeconds: 5,
                                                       message: "Failed", error: nil, weeklyGoalId: nil, workoutIds: nil)
        let vm = TrainingPlanViewModel(resumeDependencies: PlanResumeDependencies(
            isAuthenticated: { true },
            syncHealth: {
                uploads += 1
                if uploads == 1 { await withCheckedContinuation { finishUpload = $0 } }
            },
            request: { retry in
                requests.append(retry)
                return ResumePlanResponse(weekStartDate: "2026-09-21", generation: failed, started: false)
            }, latest: { nil }
        ))
        let login = Task { await vm.refreshAutomaticGeneration() }
        while finishUpload == nil { await Task.yield() }
        let foreground = Task { await vm.refreshAutomaticGeneration() }
        await Task.yield()
        finishUpload?.resume()
        await login.value
        await foreground.value
        XCTAssertEqual(requests, [false])
        XCTAssertTrue(vm.canRetryGeneration)
        XCTAssertNil(vm.errorMessage) // Generation failure does not report workout-save failure.
        await vm.refreshAutomaticGeneration(retryFailed: true)
        XCTAssertEqual(requests, [false, true])
        vm.cancelPendingGeneration()
    }

    @MainActor
    func testLogoutPreventsResumeAfterDelayedHealthSync() async {
        var finishUpload: CheckedContinuation<Void, Never>?
        var requested = false
        let vm = TrainingPlanViewModel(resumeDependencies: PlanResumeDependencies(
            isAuthenticated: { true },
            syncHealth: { await withCheckedContinuation { finishUpload = $0 } },
            request: { _ in
                requested = true
                return ResumePlanResponse(weekStartDate: nil, generation: nil, started: false)
            }, latest: { nil }
        ))
        let task = Task { await vm.refreshAutomaticGeneration() }
        while finishUpload == nil { await Task.yield() }
        vm.cancelPendingGeneration()
        finishUpload?.resume()
        await task.value
        XCTAssertFalse(requested)
        XCTAssertFalse(vm.isResumingPlan)
        XCTAssertFalse(vm.canRetryGeneration)
    }

    @MainActor
    func testResumeNetworkFailureIsQuietUnlessUserExplicitlyRetries() async {
        let vm = TrainingPlanViewModel(resumeDependencies: PlanResumeDependencies(
            isAuthenticated: { true }, syncHealth: {}, request: { _ in throw TestError.boom }, latest: { nil }
        ))
        await vm.refreshAutomaticGeneration()
        XCTAssertNil(vm.generationErrorMessage)
        await vm.refreshAutomaticGeneration(retryFailed: true)
        XCTAssertNotNil(vm.generationErrorMessage)
        XCTAssertTrue(vm.canRetryGeneration)
        vm.cancelPendingGeneration()
    }

    func testWriteAuthorizationRequestsWorkoutAndRouteTogether() {
        let types = HealthKitService.writeAuthorizationTypes

        XCTAssertTrue(types.contains(HKObjectType.workoutType()))
        XCTAssertTrue(types.contains(HKSeriesType.workoutRoute()))
        XCTAssertTrue(types.contains(HKQuantityType(.distanceWalkingRunning)))
        XCTAssertTrue(types.contains(HKQuantityType(.activeEnergyBurned)))
        XCTAssertTrue(types.contains(HKQuantityType(.heartRate)))
    }

    func testWorkoutWritePermissionIsRequiredButSupplementalTypesAreOptional() {
        let supplementalTypesDenied = HealthKitWriteAuthorizationSnapshot(
            workout: .sharingAuthorized,
            route: .sharingDenied,
            distance: .sharingDenied,
            energy: .sharingDenied
        )
        let workoutDenied = HealthKitWriteAuthorizationSnapshot(
            workout: .sharingDenied,
            route: .sharingAuthorized,
            distance: .sharingAuthorized,
            energy: .sharingAuthorized
        )

        XCTAssertTrue(supplementalTypesDenied.canWriteWorkout)
        XCTAssertFalse(supplementalTypesDenied.canWriteRoute)
        XCTAssertFalse(supplementalTypesDenied.canWriteDistance)
        XCTAssertFalse(supplementalTypesDenied.canWriteEnergy)
        XCTAssertFalse(workoutDenied.canWriteWorkout)
    }

    func testDateOnlyWorkoutMatchesReferenceDay() {
        let workout = makeWorkout(date: "2026-06-30")
        let reference = makeDate(year: 2026, month: 6, day: 30)

        XCTAssertTrue(workout.isOnDay(reference, calendar: calendar))
    }

    func testDateOnlyWorkoutDoesNotMatchDifferentDay() {
        let workout = makeWorkout(date: "2026-06-30")
        let previousDay = makeDate(year: 2026, month: 6, day: 29)
        let nextDay = makeDate(year: 2026, month: 7, day: 1)

        XCTAssertFalse(workout.isOnDay(previousDay, calendar: calendar))
        XCTAssertFalse(workout.isOnDay(nextDay, calendar: calendar))
    }

    func testInternetDateWorkoutMatchesReferenceDay() {
        let workout = makeWorkout(date: "2026-06-30T14:30:00.000Z")
        let reference = makeDate(year: 2026, month: 6, day: 30, hour: 9)

        XCTAssertTrue(workout.isOnDay(reference, calendar: calendar))
    }

    func testWorkoutModelDecodesAppleHealthWorkoutUUID() throws {
        let data = Data("""
        {
          "id": "workout-1",
          "date": "2026-06-30",
          "sportType": "running",
          "title": "Tiros",
          "blocks": [],
          "status": "done",
          "appleHealthWorkoutUUID": "hk-uuid-1"
        }
        """.utf8)

        let workout = try JSONDecoder().decode(WorkoutModel.self, from: data)

        XCTAssertEqual(workout.appleHealthWorkoutUUID, "hk-uuid-1")
        XCTAssertNil(workout.nextWeekGeneration)
    }

    func testWorkoutResponseKeepsCompletionWhenGenerationIsQueuedOrFailed() throws {
        for status in ["queued", "failed"] {
            let data = Data("""
            {"id":"w1","date":"2026-09-11","sportType":"running","title":"Run","blocks":[],"status":"done",
             "nextWeekGeneration":{"closed":true,"generationId":"g1","status":"\(status)","pollAfterSeconds":5}}
            """.utf8)
            let workout = try JSONDecoder().decode(WorkoutModel.self, from: data)
            XCTAssertEqual(workout.status, .done)
            XCTAssertEqual(workout.nextWeekGeneration?.generationId, "g1")
            XCTAssertEqual(workout.nextWeekGeneration?.status, status)
        }
    }

    func testCompletionPayloadIncludesExecutionAndPlannerSnapshotTogether() throws {
        let run = makeHealthRun(id: "health-uuid", daysAgo: 0)
        let context = PlannerHealthContextPayload(runs: [HealthRunPayload(from: run)], detailedSessions: nil,
                                                  timeZone: "America/Sao_Paulo", capturedAt: "2026-09-11T10:00:00Z")
        let request = CompleteWorkoutRequest(appleHealthWorkoutUUID: "health-uuid", actualDistanceMeters: 5000,
                                             actualDurationSeconds: 1800, executionDetails: nil, planningContext: context)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
        XCTAssertEqual(object["actualDistanceMeters"] as? Double, 5000)
        let snapshot = try XCTUnwrap(object["planningContext"] as? [String: Any])
        XCTAssertEqual(snapshot["timeZone"] as? String, "America/Sao_Paulo")
        let runs = try XCTUnwrap(snapshot["runs"] as? [[String: Any]])
        XCTAssertEqual(runs.first?["appleHealthWorkoutUUID"] as? String, "health-uuid")
    }

    @MainActor
    func testCalendarDragBoundaryRunsMondayThroughSundayAcrossYearChange() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let monday = formatter.date(from: "2026-12-28")!
        let sunday = formatter.date(from: "2027-01-03")!
        let nextMonday = formatter.date(from: "2027-01-04")!
        XCTAssertEqual(PlanView.weekStart(for: monday), PlanView.weekStart(for: sunday))
        XCTAssertNotEqual(PlanView.weekStart(for: monday), PlanView.weekStart(for: nextMonday))
    }

    func testRunSessionDecodesWithoutSegmentRecords() throws {
        let data = Data("""
        {
          "id": "2C9B012B-40D1-47DA-9DAB-0F4F4E49E3E9",
          "startDate": "2026-06-30T10:00:00Z",
          "endDate": "2026-06-30T10:30:00Z",
          "distanceMeters": 5000,
          "durationSeconds": 1800,
          "averagePaceSecondsPerKm": 360,
          "elevationGainMeters": 20,
          "caloriesBurned": 300,
          "status": "completed",
          "sportType": "running",
          "routePoints": [],
          "splits": [],
          "backendId": null,
          "synced": false
        }
        """.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let session = try decoder.decode(RunSession.self, from: data)

        XCTAssertNil(session.segmentRecords)
        XCTAssertNil(session.athlyWorkoutId)
        XCTAssertNil(session.healthKitWorkoutUUID)
        XCTAssertNil(session.healthKitSyncStatus)
        XCTAssertNil(session.healthKitSyncError)
    }

    func testRunSessionDecodesHealthKitSyncMetadata() throws {
        let data = Data("""
        {
          "id": "2C9B012B-40D1-47DA-9DAB-0F4F4E49E3E9",
          "startDate": "2026-07-06T10:00:00Z",
          "endDate": "2026-07-06T10:30:00Z",
          "distanceMeters": 5000,
          "durationSeconds": 1800,
          "averagePaceSecondsPerKm": 360,
          "elevationGainMeters": 20,
          "caloriesBurned": 300,
          "status": "completed",
          "sportType": "running",
          "routePoints": [],
          "splits": [],
          "segmentRecords": [],
          "pauseIntervals": [],
          "athlyWorkoutId": "workout-1",
          "healthKitWorkoutUUID": "hk-uuid-1",
          "healthKitSyncStatus": "synced",
          "healthKitSyncError": null,
          "backendId": null,
          "synced": false
        }
        """.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let session = try decoder.decode(RunSession.self, from: data)

        XCTAssertEqual(session.athlyWorkoutId, "workout-1")
        XCTAssertEqual(session.healthKitWorkoutUUID, "hk-uuid-1")
        XCTAssertEqual(session.healthKitSyncStatus, .synced)
        XCTAssertNil(session.healthKitSyncError)
    }

    func testHealthKitRunItemCodableRoundTrips() throws {
        let run = makeHealthRun(id: "hk-run-1", daysAgo: 1)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let decoded = try decoder.decode(HealthKitRunItem.self, from: encoder.encode(run))

        XCTAssertEqual(decoded, run)
    }

    @MainActor
    func testHealthKitRunsViewModelKeepsCachedRunsWhenRefreshFails() async {
        let cachedRun = makeHealthRun(id: "cached-run", daysAgo: 2)
        let cache = MemoryHealthKitRunsCache(
            snapshot: HealthKitRunsCacheSnapshot(
                runs: [cachedRun],
                linkedRunsById: [:],
                updatedAt: makeDate(year: 2026, month: 7, day: 1)
            )
        )
        let service = FakeHealthKitRunningWorkoutsProvider()
        service.pageError = TestError.boom
        let viewModel = HealthKitRunsViewModel(healthKitService: service, cache: cache, pageSize: 2)

        await viewModel.loadWorkouts()

        XCTAssertEqual(viewModel.runs, [cachedRun])
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isInitialLoading)
    }

    @MainActor
    func testHealthKitRunsViewModelShowsErrorWhenRefreshFailsWithoutCache() async {
        let service = FakeHealthKitRunningWorkoutsProvider()
        service.pageError = TestError.boom
        let viewModel = HealthKitRunsViewModel(
            healthKitService: service,
            cache: MemoryHealthKitRunsCache(),
            pageSize: 2
        )

        await viewModel.loadWorkouts()

        XCTAssertTrue(viewModel.runs.isEmpty)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    @MainActor
    func testHealthKitRunsViewModelFetchesLinkedRunsAndPersistsThem() async {
        let linkedRun = makeHealthRun(id: "linked-run", daysAgo: 0)
        let cache = MemoryHealthKitRunsCache()
        let service = FakeHealthKitRunningWorkoutsProvider()
        service.itemsByUUID = ["linked-run": linkedRun]
        let viewModel = HealthKitRunsViewModel(healthKitService: service, cache: cache, pageSize: 2)

        await viewModel.ensureRunItems(workoutUUIDs: ["linked-run"])

        XCTAssertEqual(viewModel.linkedRunsById["linked-run"], linkedRun)
        XCTAssertEqual(cache.snapshot?.linkedRunsById["linked-run"], linkedRun)
        XCTAssertFalse(viewModel.isResolvingLinkedRuns)
    }

    @MainActor
    func testHealthKitRunsViewModelLoadsMoreWithOldestEndDateCursor() async {
        let newest = makeHealthRun(id: "newest", daysAgo: 0)
        let older = makeHealthRun(id: "older", daysAgo: 1)
        let oldest = makeHealthRun(id: "oldest", daysAgo: 2)
        let service = FakeHealthKitRunningWorkoutsProvider()
        service.pageHandler = { beforeEndDate in
            beforeEndDate == nil ? [newest, older] : [oldest]
        }
        let viewModel = HealthKitRunsViewModel(
            healthKitService: service,
            cache: MemoryHealthKitRunsCache(),
            pageSize: 2
        )

        await viewModel.loadWorkouts()
        await viewModel.loadMoreIfNeeded(currentItem: older)

        XCTAssertEqual(service.requestedPageCursors.count, 2)
        XCTAssertNil(service.requestedPageCursors[0])
        XCTAssertEqual(service.requestedPageCursors[1], older.endDate)
        XCTAssertEqual(viewModel.runs.map(\.id), ["newest", "older", "oldest"])
        XCTAssertFalse(viewModel.canLoadMore)
    }

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func makeDate(year: Int, month: Int, day: Int, hour: Int = 12) -> Date {
        DateComponents(
            calendar: calendar,
            timeZone: calendar.timeZone,
            year: year,
            month: month,
            day: day,
            hour: hour
        ).date!
    }

    private func makeWorkout(date: String) -> WorkoutModel {
        WorkoutModel(
            id: UUID().uuidString,
            date: date,
            sportType: .running,
            title: "Corrida leve",
            description: nil,
            blocks: [],
            segments: nil,
            status: .scheduled,
            trainingPlanId: "plan-1",
            weeklyGoalId: "week-1",
            intensity: 3,
            isGoalAttempt: false,
            actualDistanceMeters: nil,
            actualDurationSeconds: nil,
            stravaActivityId: nil,
            appleHealthWorkoutUUID: nil
        )
    }

    private func makeHealthRun(id: String, daysAgo: Int) -> HealthKitRunItem {
        let baseDate = makeDate(year: 2026, month: 7, day: 3, hour: 7)
        let startDate = calendar.date(byAdding: .day, value: -daysAgo, to: baseDate)!
        let durationSeconds = 1_800.0
        let distanceMeters = 5_000.0
        return HealthKitRunItem(
            id: id,
            startDate: startDate,
            endDate: startDate.addingTimeInterval(durationSeconds),
            durationSeconds: durationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: durationSeconds / (distanceMeters / 1_000),
            activeEnergyBurned: 300,
            elevationGainMeters: 20
        )
    }
}

private enum TestError: Error {
    case boom
}

private final class MemoryHealthKitRunsCache: HealthKitRunsCaching, @unchecked Sendable {
    var snapshot: HealthKitRunsCacheSnapshot?

    init(snapshot: HealthKitRunsCacheSnapshot? = nil) {
        self.snapshot = snapshot
    }

    func load() -> HealthKitRunsCacheSnapshot? {
        snapshot
    }

    func save(_ snapshot: HealthKitRunsCacheSnapshot) {
        self.snapshot = snapshot
    }

    func clear() {
        snapshot = nil
    }
}

private final class FakeHealthKitRunningWorkoutsProvider: HealthKitRunningWorkoutsProviding, @unchecked Sendable {
    var isHealthDataAvailable = true
    var pageError: Error?
    var pageHandler: ((Date?) async throws -> [HealthKitRunItem])?
    var requestedPageCursors: [Date?] = []
    var itemsByUUID: [String: HealthKitRunItem] = [:]

    func requestReadAuthorization() async throws {}

    func requestWriteAuthorization() async throws -> HealthKitWriteAuthorizationSnapshot {
        .fullyAuthorized
    }

    func fetchLatestRunningWorkouts(limit: Int) async throws -> [HealthKitRunItem] {
        try await fetchRunningWorkoutsPage(limit: limit, beforeEndDate: nil)
    }

    func fetchRunningWorkoutsPage(limit: Int, beforeEndDate: Date?) async throws -> [HealthKitRunItem] {
        requestedPageCursors.append(beforeEndDate)
        if let pageError {
            throw pageError
        }
        let items: [HealthKitRunItem]
        if let pageHandler {
            items = try await pageHandler(beforeEndDate)
        } else {
            items = []
        }
        return items.prefix(limit).map { $0 }
    }

    func fetchRunningWorkout(uuid: String) async throws -> HealthKitRunItem? {
        itemsByUUID[uuid]
    }

    func diagnose(windowStart: Date, windowEnd: Date, contextLabel: String) async {}

    func diagnoseZeppWorkouts(limit: Int) async {}
}

@MainActor
final class NavigationPerformanceTests: XCTestCase {
    private func workout(_ id: String, date: String, sport: String = "running") throws -> WorkoutModel {
        let object: [String: Any] = ["id": id, "date": date, "title": "Run", "status": "scheduled",
                                    "sportType": sport, "blocks": [], "weeklyGoalId": "week"]
        return try JSONDecoder().decode(WorkoutModel.self, from: JSONSerialization.data(withJSONObject: object))
    }

    func testDateOnlyParserPreservesDayAcrossTimeZonesAndSupportsLegacyISO() throws {
        for name in ["America/Sao_Paulo", "Pacific/Auckland", "Asia/Tokyo"] {
            let zone = try XCTUnwrap(TimeZone(identifier: name))
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = zone
            let date = try XCTUnwrap(WorkoutDateParser.date(from: "2026-10-05", timeZone: zone))
            XCTAssertEqual(calendar.component(.day, from: date), 5)
            XCTAssertEqual(calendar.component(.hour, from: date), 0)
        }
        XCTAssertEqual(WorkoutDateParser.date(from: "2026-10-05T12:00:00.000Z"),
                       WorkoutDateParser.date(from: "2026-10-05T12:00:00Z"))
        XCTAssertNil(WorkoutDateParser.date(from: "not-a-date"))
    }

    func testIndexUpdatesAfterWorkoutMovesAndExcludesRestFromCalendar() throws {
        let vm = TrainingPlanViewModel()
        let original = try workout("run", date: "2026-10-05")
        vm.allWorkouts = [original, try workout("rest", date: "2026-10-05", sport: "other")]
        XCTAssertEqual(vm.workouts(on: original.parsedDate).map(\.id), ["run"])
        let moved = try workout("run", date: "2026-10-06")
        vm.allWorkouts = [moved]
        XCTAssertTrue(vm.workouts(on: original.parsedDate).isEmpty)
        XCTAssertEqual(vm.workouts(on: moved.parsedDate).map(\.id), ["run"])
        XCTAssertEqual(vm.workout(id: "run")?.date, "2026-10-06")
    }

    func testCalendarLookupsWith365Workouts() throws {
        let calendar = Calendar.current
        let base = try XCTUnwrap(WorkoutDateParser.date(from: "2026-10-05"))
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let vm = TrainingPlanViewModel()
        vm.allWorkouts = try (0..<365).map { offset in
            try workout(String(offset), date: formatter.string(from: calendar.date(byAdding: .day, value: -offset, to: base)!))
        }
        let days = (0..<7).map { calendar.date(byAdding: .day, value: -$0, to: base)! }
        measure {
            var total = 0
            for _ in 0..<4 { for day in days { total += vm.workouts(on: day).count } }
            XCTAssertEqual(total, 28)
        }
    }

    func testAutomaticLoadsShareRequestsAndRespectFreshnessButExplicitRefreshDoesNot() async {
        TrainingPlanCache.shared.clear()
        let gate = PerformanceTestGate()
        var reads = 0
        let vm = TrainingPlanViewModel(loadDependencies: PlanLoadDependencies(plan: {
            reads += 1
            await gate.wait()
            return nil
        }, notify: { _ in }))
        let first = Task { await vm.loadIfNeeded() }
        let second = Task { await vm.loadIfNeeded() }
        for _ in 0..<500 where reads == 0 { await Task.yield() }
        await gate.open()
        await first.value
        await second.value
        XCTAssertEqual(reads, 1)
        await vm.loadIfNeeded()
        XCTAssertEqual(reads, 1)
        await vm.loadData()
        XCTAssertEqual(reads, 2)
        vm.invalidateDataLoad()
        await vm.loadIfNeeded()
        XCTAssertEqual(reads, 3)
        TrainingPlanCache.shared.clear()
    }

    func testSnapshotWritesCoalesceAndClearCannotBeUndoneByOlderWrites() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("cache.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let file = SnapshotFile<[Int]>(url: url)
        for i in 0..<200 { file.save(Array(repeating: i, count: 100)) }
        file.clear()
        try await file.flush()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        file.save([999])
        try await file.flush()
        let restored = try await SnapshotFile<[Int]>(url: url).load()
        XCTAssertEqual(restored, [999])
    }

    func testRunHydrationMergesEarlyChangesAndPersistsAnImmutableCompatibleSnapshot() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("runs.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let original = RunSession()
        original.distanceMeters = 5000
        original.routePoints = [RoutePoint(latitude: -23, longitude: -46, altitude: 5, timestamp: Date())]
        let initial = SnapshotFile<[RunSessionSnapshot]>(url: url)
        initial.save([RunSessionSnapshot(original)])
        try await initial.flush()
        let store = RunStore(fileURL: url)
        let early = RunSession()
        early.distanceMeters = 1000
        store.add(early)
        try await store.flush()
        XCTAssertEqual(store.sessions.count, 2)
        let snapshot = RunSessionSnapshot(original)
        original.distanceMeters = 99
        XCTAssertEqual(snapshot.distanceMeters, 5000)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let restored = try decoder.decode([RunSession].self, from: Data(contentsOf: url))
        XCTAssertEqual(restored.count, 2)
        XCTAssertEqual(restored.first { $0.id == original.id }?.routePoints.count, 1)
        let revision = store.revision
        early.distanceMeters = 2000
        store.update(early)
        XCTAssertGreaterThan(store.revision, revision)
        try await store.flush()
    }

    func testUnreadableHistoryIsNotOverwrittenAndWriteFailuresAreReported() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let url = directory.appendingPathComponent("runs.json")
        let corrupt = Data("corrupt-history".utf8)
        try corrupt.write(to: url)
        let store = RunStore(fileURL: url)
        store.add(RunSession())
        do { try await store.flush(); XCTFail("Must not overwrite unreadable history") } catch {}
        XCTAssertEqual(try Data(contentsOf: url), corrupt)
        let blocked = SnapshotFile<[Int]>(url: url.appendingPathComponent("child.json"))
        blocked.save([1])
        do { try await blocked.flush(); XCTFail("Must surface write error") } catch {}
    }

    func testHealthSummariesAppearBeforeHeartRateEnrichmentCompletes() async {
        let service = ProgressiveHealthProvider()
        let vm = HealthKitRunsViewModel(healthKitService: service, cache: MemoryHealthKitRunsCache())
        let loading = Task { await vm.loadWorkouts() }
        for _ in 0..<1000 where vm.runs.isEmpty { await Task.yield() }
        XCTAssertEqual(vm.runs.map(\.id), ["summary"])
        XCTAssertNil(vm.runs.first?.avgHR)
        XCTAssertFalse(vm.isInitialLoading)
        await service.gate.open()
        await loading.value
        XCTAssertEqual(vm.runs.first?.avgHR, 150)
    }
}

private actor PerformanceTestGate {
    private var opened = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if opened { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func open() {
        opened = true
        let waiting = waiters
        waiters = []
        for waiter in waiting { waiter.resume() }
    }
}

private final class ProgressiveHealthProvider: HealthKitRunningWorkoutsProviding, Sendable {
    let gate = PerformanceTestGate()
    var isHealthDataAvailable: Bool { true }
    func requestReadAuthorization() async throws {}
    func requestWriteAuthorization() async throws -> HealthKitWriteAuthorizationSnapshot { .fullyAuthorized }
    func fetchLatestRunningWorkouts(limit: Int) async throws -> [HealthKitRunItem] { [] }
    func fetchRunningWorkoutsPage(limit: Int, beforeEndDate: Date?) async throws -> [HealthKitRunItem] { [] }
    func fetchRunningWorkout(uuid: String) async throws -> HealthKitRunItem? { nil }
    func diagnose(windowStart: Date, windowEnd: Date, contextLabel: String) async {}
    func diagnoseZeppWorkouts(limit: Int) async {}
    func fetchRunningWorkoutSummariesPage(limit: Int, beforeEndDate: Date?) async throws -> [HealthKitRunItem] {
        [HealthKitRunItem(id: "summary", startDate: Date(), endDate: Date(), durationSeconds: 1800,
                         distanceMeters: 5000, averagePaceSecondsPerKm: 360, activeEnergyBurned: 300, elevationGainMeters: 0)]
    }
    func enrichHeartRates(_ items: [HealthKitRunItem]) async throws -> [HealthKitRunItem] {
        await gate.wait()
        return items.map { item in var enriched = item; enriched.avgHR = 150; return enriched }
    }
}
