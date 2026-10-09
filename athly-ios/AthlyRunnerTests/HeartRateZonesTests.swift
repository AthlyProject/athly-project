import XCTest
@testable import AthlyRunner

private actor HeartRateTestHealth: HeartRateHealthProviding {
    var sample: HeartRateHealthSnapshot?
    var shouldFail = false
    var holdCapture = false
    var authorizationCount = 0
    var captureCount = 0
    private var continuation: CheckedContinuation<Void, Never>?

    func configure(sample: HeartRateHealthSnapshot? = nil, fail: Bool = false, hold: Bool = false) {
        self.sample = sample
        shouldFail = fail
        holdCapture = hold
    }
    func requestHeartRateReadAuthorization() async throws { authorizationCount += 1 }
    func fetchRestingHeartRate() async throws -> HeartRateHealthSnapshot? {
        captureCount += 1
        if holdCapture { await withCheckedContinuation { continuation = $0 } }
        if shouldFail { throw URLError(.cannotLoadFromNetwork) }
        return sample
    }
    func release() { continuation?.resume(); continuation = nil }
    var isWaiting: Bool { continuation != nil }
}

private actor HeartRateTestServer {
    var uploads = 0
    var maximum = 190
    var failUpload = false
    var estimated = false
    func configure(maximum: Int = 190, failUpload: Bool = false, estimated: Bool = false) {
        self.maximum = maximum
        self.failUpload = failUpload
        self.estimated = estimated
    }
    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        if request.httpMethod == "PUT" {
            uploads += 1
            if failUpload { throw URLError(.notConnectedToInternet) }
        }
        let source = estimated ? "age_estimate" : "manual"
        let json = """
        {"status":"available","method":"hrr_v1","isEstimated":\(estimated),"missingData":[],
         "restingHeartRate":{"bpm":60,"source":"apple_health","measuredAt":"2026-09-30T12:00:00.000Z"},
         "maxHeartRate":{"bpm":\(maximum),"source":"\(source)","measuredAt":null},
         "zones":[{"zone":1,"minBpm":125,"maxBpm":137}]}
        """
        return (Data(json.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
    }
}

@MainActor
final class HeartRateZonesTests: XCTestCase {
    private func client(_ server: HeartRateTestServer) async -> APIClient {
        let client = APIClient(transport: { try await server.send($0) }, persistTokens: { _ in }, deleteTokens: {})
        await client.setTokens(access: "test-access", refresh: "test-refresh")
        return client
    }

    func testProfileEncodingDistinguishesOmittedFieldsFromExplicitAutomaticReset() throws {
        let partial = try JSONSerialization.jsonObject(with: JSONEncoder().encode(UpdateProfileRequest(name: "Runner"))) as! [String: Any]
        XCTAssertNil(partial["restingHeartRate"])
        XCTAssertNil(partial["maxHeartRate"])
        let reset = try JSONSerialization.jsonObject(with: JSONEncoder().encode(UpdateProfileRequest(clearRestingHeartRate: true))) as! [String: Any]
        XCTAssertTrue(reset["restingHeartRate"] is NSNull)
        XCTAssertNil(reset["maxHeartRate"])
        let manual = try JSONSerialization.jsonObject(with: JSONEncoder().encode(UpdateProfileRequest(maxHeartRate: 190))) as! [String: Any]
        XCTAssertEqual(manual["maxHeartRate"] as? Int, 190)
        XCTAssertNil(manual["restingHeartRate"])
    }

    func testAbsentHealthDataDoesNotUploadAnEmptyReplacementOrClaimPermissionDenied() async {
        let server = HeartRateTestServer()
        let health = HeartRateTestHealth()
        let model = HeartRateZonesViewModel(api: await client(server), health: health)
        await model.refresh(requestAuthorization: true)
        XCTAssertNotNil(model.zones)
        XCTAssertNotNil(model.syncMessage)
        XCTAssertNil(model.errorMessage)
        let uploads = await server.uploads
        let authorizations = await health.authorizationCount
        XCTAssertEqual(uploads, 0)
        XCTAssertEqual(authorizations, 1)
    }

    func testReadFailureKeepsSavedZonesAndAllowsRetry() async {
        let server = HeartRateTestServer()
        let health = HeartRateTestHealth()
        await health.configure(fail: true)
        let model = HeartRateZonesViewModel(api: await client(server), health: health)
        await model.refresh(requestAuthorization: true)
        XCTAssertNotNil(model.syncMessage)
        XCTAssertNotNil(model.zones)
        XCTAssertFalse(model.isLoading)
        await health.configure(sample: HeartRateHealthSnapshot(restingHeartRate: 60, measuredAt: Date(), capturedAt: Date()))
        await model.refresh(requestAuthorization: true)
        XCTAssertNil(model.syncMessage)
        let uploads = await server.uploads
        XCTAssertEqual(uploads, 1)
    }

    func testNetworkFailurePreservesSavedZonesAndShowsRetryError() async {
        let server = HeartRateTestServer()
        await server.configure(failUpload: true)
        let health = HeartRateTestHealth()
        await health.configure(sample: HeartRateHealthSnapshot(restingHeartRate: 60, measuredAt: Date(), capturedAt: Date()))
        let model = HeartRateZonesViewModel(api: await client(server), health: health)
        await model.refresh()
        XCTAssertNotNil(model.zones)
        XCTAssertNotNil(model.errorMessage)
        XCTAssertFalse(model.isLoading)
    }

    func testRefreshAfterEditingLoadsNewMaximumWithoutAnotherHealthCapture() async {
        let server = HeartRateTestServer()
        let health = HeartRateTestHealth()
        let model = HeartRateZonesViewModel(api: await client(server), health: health)
        await model.refresh(syncHealth: false)
        XCTAssertEqual(model.zones?.maxHeartRate?.bpm, 190)
        await server.configure(maximum: 187, estimated: true)
        await model.refresh(syncHealth: false)
        XCTAssertEqual(model.zones?.maxHeartRate?.bpm, 187)
        XCTAssertEqual(model.zones?.maxHeartRate?.source, "age_estimate")
        XCTAssertEqual(model.zones?.isEstimated, true)
        XCTAssertNotNil(model.zones?.restingHeartRate?.measurementDate)
        let captures = await health.captureCount
        XCTAssertEqual(captures, 0)
    }

    func testOldCaptureCannotUploadUnderANewSessionEvenBeforeTheViewReceivesLogout() async {
        let server = HeartRateTestServer()
        let api = await client(server)
        let health = HeartRateTestHealth()
        await health.configure(sample: HeartRateHealthSnapshot(restingHeartRate: 60, measuredAt: Date(), capturedAt: Date()), hold: true)
        let model = HeartRateZonesViewModel(api: api, health: health)
        let refresh = Task { await model.refresh() }
        for _ in 0..<1000 {
            if await health.isWaiting { break }
            await Task.yield()
        }
        let waiting = await health.isWaiting
        XCTAssertTrue(waiting)
        await api.setTokens(access: "other-user", refresh: "other-refresh")
        await health.release()
        await refresh.value
        let uploads = await server.uploads
        XCTAssertEqual(uploads, 0)
        model.cancel(clear: true)
        XCTAssertNil(model.zones)
    }

    func testLogoutCancelsCaptureAndClearsViewState() async {
        let server = HeartRateTestServer()
        let api = await client(server)
        let health = HeartRateTestHealth()
        await health.configure(sample: HeartRateHealthSnapshot(restingHeartRate: 60, measuredAt: Date(), capturedAt: Date()), hold: true)
        let model = HeartRateZonesViewModel(api: api, health: health)
        let refresh = Task { await model.refresh() }
        for _ in 0..<1000 {
            if await health.isWaiting { break }
            await Task.yield()
        }
        model.cancel(clear: true)
        await api.clearTokens()
        await health.release()
        await refresh.value
        XCTAssertNil(model.zones)
        XCTAssertNil(model.errorMessage)
        XCTAssertFalse(model.isLoading)
        let uploads = await server.uploads
        XCTAssertEqual(uploads, 0)
    }
    func testProfileVisibilityRequiresExplicitRecentHRGuidance() throws {
        let base = #"{"status":"available","method":"hrr_v1","isEstimated":false,"missingData":[],"zones":[]}"#
        let decoder = JSONDecoder()
        let legacy = try decoder.decode(HeartRateZones.self, from: Data(base.utf8))
        XCTAssertFalse(legacy.shouldShowInProfile)
        for mode in ["rpe", "heart_rate_and_rpe"] {
            let json = base.dropLast() + ",\"trainingGuidance\":{\"mode\":\"\(mode)\",\"reason\":\"available\"}}"
            let zones = try decoder.decode(HeartRateZones.self, from: Data(json.utf8))
            XCTAssertEqual(zones.shouldShowInProfile, mode == "heart_rate_and_rpe")
        }
        let insufficient = base.replacingOccurrences(of: "available", with: "insufficient_data").dropLast()
            + #", "trainingGuidance":{"mode":"heart_rate_and_rpe","reason":"missing_zone_inputs"}}"#
        XCTAssertFalse(try decoder.decode(HeartRateZones.self, from: Data(insufficient.utf8)).shouldShowInProfile)
    }

    func testPrescriptionDisplaysSavedBpmAndRpeAndSupportsOldTargets() throws {
        let decoder = JSONDecoder()
        let target = try decoder.decode(SegmentTarget.self, from: Data(#"{"hrZone":2,"hrMinBpm":138,"hrMaxBpm":150,"hrIsEstimated":false,"rpe":4}"#.utf8))
        XCTAssertEqual(target.effortTargetText, "Z2 (138–150 bpm) · RPE 4/10")
        let old = try decoder.decode(SegmentTarget.self, from: Data(#"{"hrZone":2}"#.utf8))
        XCTAssertEqual(old.effortTargetText, "Z2")
        XCTAssertNil(old.hrMinBpm)
        let rpe = try decoder.decode(SegmentTarget.self, from: Data(#"{"rpe":4}"#.utf8))
        XCTAssertEqual(rpe.effortTargetText, "RPE 4/10")
        XCTAssertNil(rpe.heartRateTargetText)
        let estimated = try decoder.decode(SegmentTarget.self, from: Data(#"{"hrZone":2,"hrMinBpm":138,"hrMaxBpm":150,"hrIsEstimated":true,"rpe":4}"#.utf8))
        XCTAssertTrue(estimated.effortTargetText!.contains(String(localized: "Estimada")))
    }

    func testLightweightRunUploadRetainsMeasuredHeartRateAndOldCacheStillDecodes() throws {
        let item = HealthKitRunItem(id: "workout", startDate: Date(), endDate: Date(), durationSeconds: 1800,
                                   distanceMeters: 5000, averagePaceSecondsPerKm: 360, activeEnergyBurned: 300,
                                   elevationGainMeters: nil, avgHR: 145.5, maxHR: 172)
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(HealthRunPayload(from: item))) as! [String: Any]
        XCTAssertEqual(json["avgHR"] as? Double, 145.5)
        XCTAssertEqual(json["maxHR"] as? Double, 172)
        var cached = try JSONSerialization.jsonObject(with: JSONEncoder().encode(item)) as! [String: Any]
        cached.removeValue(forKey: "avgHR")
        cached.removeValue(forKey: "maxHR")
        let decoded = try JSONDecoder().decode(HealthKitRunItem.self, from: JSONSerialization.data(withJSONObject: cached))
        XCTAssertNil(decoded.avgHR)
        XCTAssertNil(decoded.maxHR)
    }

    func testGenerationHealthSyncDoesNotNeedAProfileViewAndSkipsEmptyRead() async throws {
        let server = HeartRateTestServer()
        let api = await client(server)
        let health = HeartRateTestHealth()
        let session = await api.heartRateSessionIdentifier
        let absent = try await HeartRateHealthSync.sync(api: api, health: health, session: session)
        XCTAssertNil(absent)
        let emptyUploads = await server.uploads
        XCTAssertEqual(emptyUploads, 0)
        await health.configure(sample: HeartRateHealthSnapshot(restingHeartRate: 60, measuredAt: Date(), capturedAt: Date()))
        let result = try await HeartRateHealthSync.sync(api: api, health: health, session: session)
        XCTAssertNotNil(result)
        let uploads = await server.uploads
        XCTAssertEqual(uploads, 1)
    }

    func testOldSessionCannotUploadPlannerHistory() async throws {
        let server = HeartRateTestServer()
        let api = await client(server)
        let oldSession = await api.heartRateSessionIdentifier
        await api.setTokens(access: "another-user", refresh: "another-refresh")
        do {
            try await api.syncPlannerHealthContext(PlannerHealthContextPayload(runs: [], detailedSessions: nil,
                timeZone: "UTC", capturedAt: "2026-09-30T12:00:00Z"), session: oldSession)
            XCTFail("Expected stale capture cancellation")
        } catch is CancellationError { }
    }

    func testProfileRefreshReloadsGuidanceAfterHistorySyncEvenWithoutRestingSample() async {
        let server = HeartRateTestServer()
        let api = await client(server)
        let model = HeartRateZonesViewModel(api: api, health: HeartRateTestHealth(), syncHistory: {
            await server.configure(maximum: 188)
        })
        await model.refresh()
        XCTAssertEqual(model.zones?.maxHeartRate?.bpm, 188)
        let uploads = await server.uploads
        XCTAssertEqual(uploads, 0)
    }

}
