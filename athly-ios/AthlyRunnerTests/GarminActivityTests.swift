import XCTest
@testable import AthlyRunner

/// Corridas do campo de dados da Athly no Garmin: decodificação da resposta do backend, conversão
/// para `ImportedWorkout` e a regra de quando o pop-up de corrida detectada as oferece.
final class GarminActivityTests: XCTestCase {

    /// Resposta de `GET /connect-iq/activities/:id` (ver ConnectIqActivityDetailModel no backend).
    private let detailJSON = """
    {
      "id": "6f1c0e5a-9d4b-4e57-8a1e-2b9c7d3f4a10",
      "startedAt": "2026-10-14T09:00:00.000Z",
      "endedAt": "2026-10-14T09:45:00.000Z",
      "utcOffsetSec": -10800,
      "distanceMeters": 8012.4,
      "timerSeconds": 2650,
      "avgHeartRate": 151,
      "maxHeartRate": 178,
      "laps": [
        { "index": 0, "startedAt": "2026-10-14T09:00:00.000Z", "endedAt": "2026-10-14T09:10:00.000Z",
          "distanceMeters": 1700, "timerSeconds": 600, "avgHeartRate": 132, "maxHeartRate": 140, "intensity": 2 },
        { "index": 1, "startedAt": "2026-10-14T09:10:00.000Z", "endedAt": "2026-10-14T09:45:00.000Z",
          "distanceMeters": 6312.4, "timerSeconds": 2050, "avgHeartRate": null, "maxHeartRate": null, "intensity": null }
      ],
      "pauses": [ { "startedAt": "2026-10-14T09:20:00.000Z", "endedAt": "2026-10-14T09:20:50.000Z" } ],
      "points": [
        [0, -23.5613891, -46.6565712, 128],
        [2, -23.5614012, -46.6566001, 0],
        [4, 95.0, 10.0, 130],
        [6, -23.5615, -46.6567, 131]
      ]
    }
    """

    private func decodeDetail() throws -> GarminActivityDetail {
        try JSONDecoder().decode(GarminActivityDetail.self, from: Data(detailJSON.utf8))
    }

    private func date(_ iso: String) -> Date {
        try! Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(iso)
    }

    // MARK: - Conversão

    func testConvertsRouteHeartRateLapsAndPauses() throws {
        let imported = try decodeDetail().importedWorkout()
        let start = date("2026-10-14T09:00:00.000Z")

        XCTAssertEqual(imported.format, .connectIQ)
        XCTAssertEqual(imported.startDate, start)
        XCTAssertEqual(imported.endDate, date("2026-10-14T09:45:00.000Z"))
        XCTAssertEqual(imported.activeDurationSeconds, 2650)
        XCTAssertEqual(imported.totalDurationSeconds, 2700)
        XCTAssertEqual(imported.distanceMeters, 8012.4)
        XCTAssertFalse(imported.isIndoor)

        // O ponto com latitude impossível fica de fora.
        XCTAssertEqual(imported.route.count, 3)
        XCTAssertEqual(imported.route[0].coordinate.latitude, -23.5613891, accuracy: 1e-9)
        XCTAssertEqual(imported.route[2].timestamp, start.addingTimeInterval(6))
        // FC 0 é "sem FC".
        XCTAssertEqual(imported.heartRateSamples.map(\.beatsPerMinute), [128, 131])

        XCTAssertEqual(imported.laps.count, 2)
        XCTAssertEqual(imported.laps[0].durationSeconds, 600)
        XCTAssertEqual(imported.laps[0].averageHeartRate, 132)
        XCTAssertNil(imported.laps[1].averageHeartRate)

        XCTAssertEqual(imported.pauseIntervals, [
            SplitCalculator.PauseInterval(
                start: date("2026-10-14T09:20:00.000Z"),
                end: date("2026-10-14T09:20:50.000Z")
            )
        ])
    }

    func testFingerprintIsStableAcrossConversions() throws {
        let detail = try decodeDetail()
        XCTAssertEqual(try detail.importedWorkout().fingerprint, try detail.importedWorkout().fingerprint)
    }

    func testRunWithoutGPSIsIndoor() throws {
        let json = detailJSON.replacingOccurrences(
            of: #""points": \[[\s\S]*\]\s*\}"#,
            with: "\"points\": [] }",
            options: .regularExpression
        )
        let detail = try JSONDecoder().decode(GarminActivityDetail.self, from: Data(json.utf8))
        let imported = try detail.importedWorkout()
        XCTAssertTrue(imported.route.isEmpty)
        XCTAssertTrue(imported.isIndoor)
        XCTAssertTrue(imported.routeDetail.coordinates.isEmpty)
    }

    func testRejectsInvertedDates() throws {
        let json = detailJSON.replacingOccurrences(
            of: "\"endedAt\": \"2026-10-14T09:45:00.000Z\",\n  \"utcOffsetSec\"",
            with: "\"endedAt\": \"2026-10-14T08:00:00.000Z\",\n  \"utcOffsetSec\""
        )
        let detail = try JSONDecoder().decode(GarminActivityDetail.self, from: Data(json.utf8))
        XCTAssertThrowsError(try detail.importedWorkout()) { error in
            XCTAssertEqual(error as? GarminActivityConversionError, .invalidDates)
        }
    }

    func testDetectedRunSummaryUsesBackendHeartRate() throws {
        let imported = try decodeDetail().importedWorkout()
        let summary = imported.detectedRunSummary(id: "garmin:x", averageHeartRate: 151, maximumHeartRate: 178)
        XCTAssertEqual(summary.id, "garmin:x")
        XCTAssertEqual(summary.durationSeconds, 2650)
        XCTAssertEqual(summary.avgHR, 151)
        XCTAssertEqual(summary.maxHR, 178)
        XCTAssertEqual(summary.averagePaceSecondsPerKm, 2650 / 8.0124, accuracy: 0.01)
    }

    func testResolveRequestUsesBackendNames() throws {
        let data = try JSONEncoder().encode(ResolveGarminActivityRequest(resolution: .freeRun, workoutId: nil))
        XCTAssertEqual(String(decoding: data, as: UTF8.self), #"{"resolution":"free_run"}"#)
    }

    // MARK: - Quando oferecer no pop-up

    private func healthRun(id: String, from imported: ImportedWorkout, startSkew: TimeInterval = 20) -> HealthKitRunItem {
        HealthKitRunItem(
            id: id,
            startDate: imported.startDate.addingTimeInterval(startSkew),
            endDate: imported.endDate,
            durationSeconds: imported.activeDurationSeconds + 15,
            distanceMeters: imported.distanceMeters - 40,
            averagePaceSecondsPerKm: 330,
            activeEnergyBurned: 500,
            elevationGainMeters: nil
        )
    }

    private func status(
        _ imported: ImportedWorkout,
        health: [HealthKitRunItem] = [],
        sessions: [RunSession] = [],
        linked: Set<String> = [],
        acknowledged: Set<String> = []
    ) -> DetectedRunService.GarminStatus {
        DetectedRunService.garminStatus(
            imported: imported,
            healthRuns: health,
            localSessions: sessions,
            linkedUUIDs: linked,
            acknowledgedUUIDs: acknowledged
        )
    }

    func testOffersGarminRunAndCollectsTheHealthCopy() throws {
        let imported = try decodeDetail().importedWorkout()
        let copy = healthRun(id: "hk-copy", from: imported)
        let other = healthRun(id: "hk-other", from: imported, startSkew: -7_200)

        XCTAssertEqual(status(imported, health: [copy, other]), .offer(matchingHealthKitUUIDs: ["hk-copy"]))
    }

    func testSkipsWhenTheHealthCopyWasAlreadyLinked() throws {
        let imported = try decodeDetail().importedWorkout()
        let copy = healthRun(id: "hk-copy", from: imported)

        XCTAssertEqual(status(imported, health: [copy], linked: ["hk-copy"]), .alreadyHandled)
    }

    func testIgnoringTheHealthCopyStillOffersTheGarminRun() throws {
        let imported = try decodeDetail().importedWorkout()
        let copy = healthRun(id: "hk-copy", from: imported)

        XCTAssertEqual(
            status(imported, health: [copy], acknowledged: ["hk-copy"]),
            .offer(matchingHealthKitUUIDs: ["hk-copy"])
        )
    }

    func testHealthCopyWaitsForTheDataFieldForTwoHours() throws {
        let imported = try decodeDetail().importedWorkout()
        let copy = healthRun(id: "hk-copy", from: imported)

        XCTAssertTrue(DetectedRunService.shouldWaitForGarmin(
            run: copy, hasDataField: true, now: copy.endDate.addingTimeInterval(30 * 60)))
        XCTAssertFalse(DetectedRunService.shouldWaitForGarmin(
            run: copy, hasDataField: true, now: copy.endDate.addingTimeInterval(3 * 3600)))
        XCTAssertFalse(DetectedRunService.shouldWaitForGarmin(
            run: copy, hasDataField: false, now: copy.endDate.addingTimeInterval(60)))
    }

    func testSkipsWhenTheRunIsAlreadyALocalSession() throws {
        let imported = try decodeDetail().importedWorkout()
        let session = RunSession(sportType: "running")
        session.startDate = imported.startDate.addingTimeInterval(30)
        session.endDate = imported.endDate
        session.durationSeconds = imported.activeDurationSeconds
        session.distanceMeters = imported.distanceMeters + 50
        session.status = "completed"

        XCTAssertEqual(status(imported, sessions: [session]), .alreadyHandled)
    }
}
