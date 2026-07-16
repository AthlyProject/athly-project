import XCTest
@testable import AthlyRunner

final class WorkoutModelDateTests: XCTestCase {

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

    func requestWriteAuthorization() async throws {}

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
