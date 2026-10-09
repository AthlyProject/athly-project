import XCTest
@testable import AthlyRunner

@MainActor
final class WorkoutCompletionTests: XCTestCase {
    private var directory: URL!
    private var links: RunWorkoutLinkStore!
    private var runs: RunStore!

    override func setUp() async throws {
        directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        links = RunWorkoutLinkStore(fileURL: directory.appendingPathComponent("links.json"))
        runs = RunStore(fileURL: directory.appendingPathComponent("runs.json"))
        TrainingPlanCache.shared.clear()
    }

    override func tearDown() async throws {
        TrainingPlanCache.shared.clear()
        try await links.flush()
        try await runs.flush()
        try FileManager.default.removeItem(at: directory)
    }

    private func workout(_ id: String = "wednesday", status: String = "scheduled", uuid: String? = nil) throws -> WorkoutModel {
        var object: [String: Any] = ["id": id, "date": "2026-09-30", "title": "Intervalos de VO2max",
            "status": status, "sportType": "running", "blocks": [], "trainingPlanId": "plan", "weeklyGoalId": "week"]
        if let uuid { object["appleHealthWorkoutUUID"] = uuid }
        return try JSONDecoder().decode(WorkoutModel.self, from: JSONSerialization.data(withJSONObject: object))
    }

    private var healthRun: HealthKitRunItem {
        let start = ISO8601DateFormatter().date(from: "2026-09-30T13:18:20Z")!
        return HealthKitRunItem(id: "ABC", startDate: start, endDate: start.addingTimeInterval(2264),
            durationSeconds: 2264, distanceMeters: 6374, averagePaceSecondsPerKm: 355,
            activeEnergyBurned: 400, elevationGainMeters: nil)
    }

    private var imported: ImportedWorkout {
        ImportedWorkout(format: .fit, fingerprint: "same-fit", originalFileName: "run.fit",
            startDate: healthRun.startDate, endDate: healthRun.endDate,
            activeDurationSeconds: healthRun.durationSeconds, totalDurationSeconds: healthRun.durationSeconds,
            distanceMeters: healthRun.distanceMeters)
    }

    private func assertFailure(_ outcome: WorkoutCompletionOutcome, file: StaticString = #filePath, line: UInt = #line) {
        guard case .failure = outcome else { return XCTFail("Expected an explicit failure", file: file, line: line) }
    }

    func testFailedHealthCompletionDoesNotHideRunAndRetryConfirmsIt() async throws {
        let pending = try workout(), done = try workout(status: "done", uuid: "ABC")
        var requests = 0
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in
            requests += 1
            if requests == 1 { throw URLError(.notConnectedToInternet) }
            return done
        }, links: links))
        vm.allWorkouts = [pending]
        assertFailure(await vm.completeWorkoutSelection(pending, selection: .healthKit(healthRun), runStore: runs))
        XCTAssertNil(vm.errorMessage, "The completion sheet owns this error; do not also present a global alert")
        XCTAssertNil(links.athlyWorkoutId(for: "abc"))
        XCTAssertEqual(links.allOrphanCandidates(healthKitUUIDs: ["ABC"]), ["ABC"])
        XCTAssertEqual(vm.allWorkouts.first?.status, .scheduled)
        guard case .success = await vm.completeWorkoutWithHealthData(pending, healthRun: healthRun) else { return XCTFail() }
        XCTAssertEqual(links.athlyWorkoutId(for: "abc"), pending.id)
        XCTAssertEqual(vm.allWorkouts.first?.status, .done)
        XCTAssertEqual(TrainingPlanCache.shared.load()?.allWorkouts.first?.status, .done)
    }

    func testUnconfirmedServerResponseDoesNotLinkOrReportSuccess() async throws {
        let pending = try workout()
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in
            pending
        }, links: links))
        vm.allWorkouts = [pending]
        assertFailure(await vm.completeWorkoutWithHealthData(pending, healthRun: healthRun))
        XCTAssertNil(links.fetchLink(for: healthRun.id))
        XCTAssertEqual(vm.allWorkouts.first?.status, .scheduled)
        XCTAssertNil(vm.errorMessage)
    }

    func testCompletionFailureDoesNotReplaceAnUnrelatedGlobalError() async throws {
        let pending = try workout()
        let message = "Não foi possível concluir o treino."
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in
            throw APIError.serverError(400, message)
        }, links: links))
        vm.allWorkouts = [pending]
        vm.errorMessage = "Erro de outra operação"
        let outcome = await vm.completeWorkoutSelection(pending, selection: .none, runStore: runs)
        guard case .failure(let returned) = outcome else { return XCTFail("Expected a failure for the completion sheet") }
        XCTAssertEqual(returned, message)
        XCTAssertEqual(vm.errorMessage, "Erro de outra operação")
        XCTAssertEqual(vm.allWorkouts.first?.status, .scheduled)
    }

    func testConcurrentCompletionDoesNotSendTwiceOrLinkBeforeConfirmation() async throws {
        let pending = try workout(), done = try workout(status: "done", uuid: "ABC")
        var finish: CheckedContinuation<WorkoutModel, Never>?
        var requests = 0
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in
            requests += 1
            return await withCheckedContinuation { finish = $0 }
        }, links: links))
        vm.allWorkouts = [pending]
        let first = Task { await vm.completeWorkoutWithHealthData(pending, healthRun: healthRun) }
        while finish == nil { await Task.yield() }
        XCTAssertNil(links.fetchLink(for: "ABC"))
        assertFailure(await vm.completeWorkout(pending))
        XCTAssertEqual(requests, 1)
        finish?.resume(returning: done)
        guard case .success = await first.value else { return XCTFail() }
        XCTAssertEqual(links.athlyWorkoutId(for: "ABC"), pending.id)
    }

    func testCancellationIsNeverReportedAsSuccessByDetectionFlow() async throws {
        for error in [CancellationError() as Error, URLError(.cancelled)] {
            let pending = try workout()
            let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in
                throw error
            }, links: links))
            vm.allWorkouts = [pending]
            let detection = DetectedRunViewModel(run: healthRun)
            let linked = await detection.link(to: pending, planVM: vm, runStore: runs)
            XCTAssertFalse(linked)
            XCTAssertNil(detection.linkedWorkout)
            XCTAssertNotNil(detection.errorMessage)
            XCTAssertNil(links.fetchLink(for: "ABC"))
        }
    }

    func testRepeatedFitKeepsOneActivityButOnlyConfirmsPlanAfterServerSuccess() async throws {
        let pending = try workout(), done = try workout(status: "done")
        var requests = 0
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, uuid, _, _, details in
            XCTAssertNil(uuid)
            XCTAssertEqual(details?.distanceMeters, self.imported.distanceMeters)
            requests += 1
            if requests <= 2 { throw URLError(.timedOut) }
            return done
        }, fetchHealthRun: { _ in XCTFail("Local-only import must not depend on HealthKit"); return nil }, links: links))
        vm.allWorkouts = [pending]
        for _ in 0..<2 {
            assertFailure(await vm.completeWorkoutWithImportedData(pending, imported: imported,
                saveToHealthKit: false, fallback: .ask, runStore: runs))
        }
        XCTAssertEqual(runs.sessions.count, 1)
        XCTAssertEqual(runs.sessions.first?.status, "completed") // The recorded activity is real.
        XCTAssertNil(runs.sessions.first?.athlyWorkoutId) // The prescribed workout is still pending.
        XCTAssertFalse(TrainingPlanViewModel.isDayCompleted(pending.parsedDate, workouts: vm.allWorkouts))
        guard case .success = await vm.completeWorkoutWithImportedData(pending, imported: imported,
            saveToHealthKit: false, fallback: .ask, runStore: runs) else { return XCTFail() }
        XCTAssertEqual(runs.sessions.count, 1)
        XCTAssertEqual(runs.sessions.first?.athlyWorkoutId, pending.id)
        XCTAssertTrue(TrainingPlanViewModel.isDayCompleted(pending.parsedDate, workouts: vm.allWorkouts))
    }

    func testMissingHealthRunOffersFallbackAndLocalOnlyCanFinishExistingFit() async throws {
        let pending = try workout(), done = try workout(status: "done")
        links.link(healthKitUUID: "ABC", athlyWorkoutId: pending.id)
        let session = runs.upsert(imported: imported, athlyWorkoutId: pending.id)
        session.healthKitWorkoutUUID = "ABC"
        runs.update(session)
        var reads = 0, requests = 0
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, uuid, _, _, _ in
            requests += 1
            XCTAssertNil(uuid)
            return done
        }, fetchHealthRun: { _ in reads += 1; return nil }, links: links))
        vm.allWorkouts = [pending]
        guard case .healthKitFallbackRequired = await vm.completeWorkoutWithImportedData(pending,
            imported: imported, saveToHealthKit: true, fallback: .ask, runStore: runs) else { return XCTFail() }
        XCTAssertEqual(requests, 0)
        guard case .success = await vm.completeWorkoutWithImportedData(pending, imported: imported,
            saveToHealthKit: true, fallback: .localOnly, runStore: runs) else { return XCTFail() }
        XCTAssertEqual(reads, 1)
        XCTAssertEqual(requests, 1)
        XCTAssertEqual(runs.sessions.count, 1)
        XCTAssertEqual(vm.allWorkouts.first?.status, .done)
    }

    func testFreshServerStateRepairsLegacyLinksWithoutRemovingRecordedActivity() async throws {
        let pending = try workout(), other = try workout("other", status: "done", uuid: "DEF")
        links.link(healthKitUUID: "ABC", athlyWorkoutId: pending.id)
        links.link(healthKitUUID: "DEF", athlyWorkoutId: other.id)
        links.link(healthKitUUID: "unknown-plan", athlyWorkoutId: "older-workout")
        let activity = runs.upsert(imported: imported, athlyWorkoutId: pending.id)
        activity.healthKitWorkoutUUID = "ABC"
        runs.update(activity)
        XCTAssertEqual(links.completionCandidates(healthKitUUIDs: ["abc", "def"], workoutId: pending.id), ["abc"])
        links.reconcileConfirmedWorkouts([pending, other])
        runs.reconcileConfirmedWorkouts([pending, other])
        XCTAssertNil(links.fetchLink(for: "ABC"))
        XCTAssertNotNil(links.fetchLink(for: "def"))
        XCTAssertNotNil(links.fetchLink(for: "unknown-plan"))
        XCTAssertEqual(runs.sessions.count, 1)
        XCTAssertNil(runs.sessions.first?.athlyWorkoutId)
        XCTAssertEqual(runs.sessions.first?.healthKitWorkoutUUID, "ABC")
        XCTAssertEqual(runs.sessions.first?.distanceMeters, imported.distanceMeters)
        try await links.flush()
        let reloaded = RunWorkoutLinkStore(fileURL: directory.appendingPathComponent("links.json"))
        XCTAssertNil(reloaded.fetchLink(for: "ABC"))
        try await runs.flush()
        let reloadedRuns = RunStore(fileURL: directory.appendingPathComponent("runs.json"))
        await reloadedRuns.loadIfNeeded()
        XCTAssertEqual(reloadedRuns.sessions.count, 1)
    }

    func testDashboardOnlyShowsCompletedWhenAllPlannedWorkoutsAreDone() throws {
        let done = try workout(status: "done"), pending = try workout("second")
        XCTAssertFalse(TrainingPlanViewModel.isDayCompleted(done.parsedDate, workouts: []))
        XCTAssertFalse(TrainingPlanViewModel.isDayCompleted(done.parsedDate, workouts: [done, pending]))
        XCTAssertTrue(TrainingPlanViewModel.isDayCompleted(done.parsedDate, workouts: [done]))
    }

    func testReadStartedBeforeCompletionCannotRestoreScheduledStatusOrEraseLink() async throws {
        let pending = try workout(), done = try workout(status: "done", uuid: "ABC")
        let plan = TrainingPlanResponse(id: "plan", startDate: "2026-09-28", objective: "Run", targetDate: nil,
            sports: [.running], autoGenerate: false, status: "ACTIVE", createdAt: "2026-09-28", updatedAt: "2026-09-28")
        var finishRead: CheckedContinuation<[WorkoutModel], Never>?
        let vm = TrainingPlanViewModel(completionDependencies: WorkoutCompletionDependencies(request: { _, _, _, _, _ in done }, links: links),
            loadDependencies: PlanLoadDependencies(plan: { plan }, goals: { _ in [] }, workouts: { _ in
                await withCheckedContinuation { finishRead = $0 }
            }, activeGoal: { nil }, notify: { _ in }))
        vm.allWorkouts = [pending]
        let load = Task { await vm.loadData() }
        while finishRead == nil { await Task.yield() }
        guard case .success = await vm.completeWorkoutWithHealthData(pending, healthRun: healthRun) else { return XCTFail() }
        finishRead?.resume(returning: [pending])
        await load.value
        XCTAssertEqual(vm.allWorkouts.first?.status, .done)
        XCTAssertEqual(links.athlyWorkoutId(for: "abc"), done.id)
        XCTAssertEqual(TrainingPlanCache.shared.load()?.allWorkouts.first?.status, .done)
    }
}
