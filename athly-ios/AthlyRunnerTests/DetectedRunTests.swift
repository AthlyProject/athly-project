import XCTest
@testable import AthlyRunner

/// Regras da detecção automática de corridas do Apple Health não reivindicadas.
/// Testa a função pura `DetectedRunService.firstUnclaimed` — sem HealthKit.
final class DetectedRunTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_726_750_000) // 2024-09-19 ~13:26 UTC

    // MARK: - Fixtures

    private func makeRun(
        id: String = UUID().uuidString,
        startOffsetDays: Int = 0,
        startOffsetSeconds: TimeInterval = -3_600,
        durationSeconds: Double = 3_102,
        distanceMeters: Double = 8_400
    ) -> HealthKitRunItem {
        let calendar = Calendar.current
        let dayStart = calendar.date(byAdding: .day, value: -startOffsetDays, to: calendar.startOfDay(for: now))!
        let start = dayStart.addingTimeInterval(
            startOffsetDays == 0 ? startOffsetSeconds + 12 * 3_600 : 9 * 3_600
        )
        return HealthKitRunItem(
            id: id,
            startDate: start,
            endDate: start.addingTimeInterval(durationSeconds),
            durationSeconds: durationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: durationSeconds / (distanceMeters / 1_000),
            activeEnergyBurned: 520,
            elevationGainMeters: nil
        )
    }

    private func makeSession(
        from run: HealthKitRunItem,
        healthKitUUID: String?,
        startSkew: TimeInterval = 0,
        distanceSkew: Double = 0
    ) -> RunSession {
        let session = RunSession(sportType: "running")
        session.startDate = run.startDate.addingTimeInterval(startSkew)
        session.endDate = run.endDate
        session.durationSeconds = run.durationSeconds
        session.distanceMeters = run.distanceMeters + distanceSkew
        session.status = "completed"
        session.healthKitWorkoutUUID = healthKitUUID
        return session
    }

    private func detect(
        runs: [HealthKitRunItem],
        sessions: [RunSession] = [],
        linked: Set<String> = [],
        acknowledged: Set<String> = []
    ) -> HealthKitRunItem? {
        DetectedRunService.firstUnclaimed(
            runs: runs,
            localSessions: sessions,
            linkedUUIDs: linked,
            acknowledgedUUIDs: acknowledged,
            now: now
        )
    }

    // MARK: - Janela de detecção

    func testRunInsideWindowIsDetected() {
        let run = makeRun()
        XCTAssertEqual(detect(runs: [run])?.id, run.id)
    }

    func testRunTwoDaysAgoIsStillInsideWindow() {
        let run = makeRun(startOffsetDays: 2)
        XCTAssertEqual(detect(runs: [run])?.id, run.id)
    }

    func testRunOlderThanWindowIsIgnored() {
        let run = makeRun(startOffsetDays: 3)
        XCTAssertNil(detect(runs: [run]))
    }

    func testFutureRunIsIgnored() {
        var run = makeRun()
        run = HealthKitRunItem(
            id: run.id,
            startDate: now.addingTimeInterval(3_600),
            endDate: now.addingTimeInterval(7_200),
            durationSeconds: run.durationSeconds,
            distanceMeters: run.distanceMeters,
            averagePaceSecondsPerKm: run.averagePaceSecondsPerKm,
            activeEnergyBurned: run.activeEnergyBurned,
            elevationGainMeters: nil
        )
        XCTAssertNil(detect(runs: [run]))
    }

    // MARK: - Já reivindicada

    func testRunLinkedToPrescribedWorkoutIsIgnored() {
        let run = makeRun()
        XCTAssertNil(detect(runs: [run], linked: [run.id]))
    }

    func testAcknowledgedRunIsIgnored() {
        let run = makeRun()
        XCTAssertNil(detect(runs: [run], acknowledged: [run.id]))
    }

    /// Guarda-corpo principal: uma corrida iniciada pelo próprio Athly nunca pode ser
    /// oferecida de volta como "nova atividade detectada".
    func testRunAlreadySavedLocallyByUUIDIsIgnored() {
        let run = makeRun()
        let session = makeSession(from: run, healthKitUUID: run.id)
        XCTAssertNil(detect(runs: [run], sessions: [session]))
    }

    /// Mesmo sem o UUID (sessões antigas, ou gravadas antes de o UUID voltar do Health),
    /// a heurística de início/duração/distância precisa reconhecer a corrida.
    func testRunMatchingLocalSessionByToleranceIsIgnored() {
        let run = makeRun()
        let session = makeSession(from: run, healthKitUUID: nil, startSkew: 45, distanceSkew: 60)
        XCTAssertNil(detect(runs: [run], sessions: [session]))
    }

    /// Uma corrida genuinamente diferente no mesmo dia não pode ser suprimida.
    func testUnrelatedLocalSessionDoesNotSuppressDetection() {
        let run = makeRun()
        let other = makeRun(startOffsetSeconds: -25_000, distanceMeters: 3_000)
        let session = makeSession(from: other, healthKitUUID: other.id)
        XCTAssertEqual(detect(runs: [run], sessions: [session])?.id, run.id)
    }

    // MARK: - Seleção

    func testMostRecentCandidateWins() {
        let older = makeRun(startOffsetDays: 2)
        let newer = makeRun(startOffsetDays: 0)
        XCTAssertEqual(detect(runs: [older, newer])?.id, newer.id)
        XCTAssertEqual(detect(runs: [newer, older])?.id, newer.id)
    }

    func testNoRunsYieldsNil() {
        XCTAssertNil(detect(runs: []))
    }

    func testAllCandidatesClaimedYieldsNil() {
        let linkedRun = makeRun()
        let ackedRun = makeRun(startOffsetDays: 1)
        let localRun = makeRun(startOffsetDays: 2)
        let session = makeSession(from: localRun, healthKitUUID: localRun.id)

        XCTAssertNil(
            detect(
                runs: [linkedRun, ackedRun, localRun],
                sessions: [session],
                linked: [linkedRun.id],
                acknowledged: [ackedRun.id]
            )
        )
    }
}
