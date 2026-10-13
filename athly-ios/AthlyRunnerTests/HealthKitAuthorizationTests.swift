import HealthKit
import XCTest
@testable import AthlyRunner

@MainActor
final class HealthKitAuthorizationTests: XCTestCase {
    func testReadAndWriteShareOneCompleteRequestAndReusePreparation() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        try await coordinator.prepare()
        _ = try await coordinator.prepareForWriting()
        try await coordinator.prepare()

        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks, [.current])
        XCTAssertEqual(prompts, checks)
        XCTAssertEqual(prompts.first?.read.count, 4)
        XCTAssertEqual(prompts.first?.share.count, 5)
    }

    func testConcurrentConsumersWaitForTheSameAuthorization() async throws {
        let client = AuthorizationClientStub()
        await client.suspendPrompt()
        let coordinator = coordinator(client)
        let readers = (0..<10).map { _ in Task { try await coordinator.prepare() } }
        let writer = Task { try await coordinator.prepareForWriting() }
        await waitForPrompt(client)
        await client.resumePrompt()
        for reader in readers { try await reader.value }
        _ = try await writer.value
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks.count, 1)
        XCTAssertEqual(prompts.count, 1)
    }

    func testForegroundInvalidationAndProcessRestartDoNotPromptAgain() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        try await coordinator.prepare()
        await coordinator.invalidate()
        try await coordinator.prepare()
        try await self.coordinator(client).prepare()
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks.count, 3)
        XCTAssertEqual(prompts.count, 1)
    }

    func testWriteRevocationIsObservedEvenWithCachedPreparation() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        _ = try await coordinator.prepareForWriting()
        await client.setWorkoutWriteStatus(.sharingDenied)
        do {
            _ = try await coordinator.prepareForWriting()
            XCTFail("A prepared request must not cache permission to write")
        } catch HealthKitError.writeDenied { }
        // Read preparation does not require permission to write.
        try await coordinator.prepare()
        await client.setWorkoutWriteStatus(.sharingAuthorized)
        _ = try await coordinator.prepareForWriting()
        let prompts = await client.prompts
        XCTAssertEqual(prompts.count, 1)
    }

    func testUnnecessaryDoesNotMeanWriteWasGranted() async throws {
        let client = AuthorizationClientStub()
        await client.setStatus(.unnecessary)
        await client.setWorkoutWriteStatus(.sharingDenied)
        let coordinator = coordinator(client)
        try await coordinator.prepare()
        do {
            _ = try await coordinator.prepareForWriting()
            XCTFail("A previously denied permission is not authorization")
        } catch HealthKitError.writeDenied { }
        let prompts = await client.prompts
        XCTAssertTrue(prompts.isEmpty)
    }

    func testUnknownAndQueryErrorsAreNotCachedOrPrompted() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        await client.setStatus(.unknown)
        do {
            try await coordinator.prepare()
            XCTFail("Unknown status must be retried, not treated as permission")
        } catch HealthKitAuthorizationPreparationError.unknownStatus { }
        await client.setQueryError(NSError(domain: "HealthKitTest", code: 6))
        do {
            try await coordinator.prepare()
            XCTFail("Query errors must propagate")
        } catch { XCTAssertEqual((error as NSError).code, 6) }
        await client.setQueryError(nil)
        await client.setStatus(.unnecessary)
        try await coordinator.prepare()
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks.count, 3)
        XCTAssertTrue(prompts.isEmpty)
    }

    func testFailedPromptCanBeRetried() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        await client.setPromptError(NSError(domain: "HealthKitTest", code: 5))
        do {
            try await coordinator.prepare()
            XCTFail("Failed prompt must not prepare the scope")
        } catch { XCTAssertEqual((error as NSError).code, 5) }
        await client.setPromptError(nil)
        try await coordinator.prepare()
        let prompts = await client.prompts
        XCTAssertEqual(prompts.count, 2)
    }

    func testCancelledConsumerDoesNotCachePreparation() async throws {
        let client = AuthorizationClientStub()
        await client.suspendPrompt()
        let coordinator = coordinator(client)
        let task = Task { try await coordinator.prepare() }
        await waitForPrompt(client)
        task.cancel()
        await client.resumePrompt()
        do {
            try await task.value
            XCTFail("Cancelled caller must not continue into an import")
        } catch is CancellationError { }
        try await coordinator.prepare()
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks.count, 2)
        XCTAssertEqual(prompts.count, 1)
    }

    func testInvalidationDuringPromptDoesNotCacheTheOldGeneration() async throws {
        let client = AuthorizationClientStub()
        await client.suspendPrompt()
        let coordinator = coordinator(client)
        let task = Task { try await coordinator.prepare() }
        await waitForPrompt(client)
        await coordinator.invalidate()
        await client.resumePrompt()
        try await task.value
        try await coordinator.prepare()
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks.count, 2)
        XCTAssertEqual(prompts.count, 1)
    }

    func testNewCategoryIsCheckedAndRequestedAsPartOfTheCompleteScope() async throws {
        let client = AuthorizationClientStub()
        let coordinator = coordinator(client)
        try await coordinator.prepare()
        let expanded = HealthKitAuthorizationRequest(
            read: HealthKitAuthorizationRequest.current.read.union([HKQuantityType(.distanceWalkingRunning)]),
            share: HealthKitAuthorizationRequest.current.share)
        await client.setStatus(.shouldRequest)
        try await coordinator.prepare(for: expanded)
        try await coordinator.prepare(for: expanded)
        let checks = await client.checks
        let prompts = await client.prompts
        XCTAssertEqual(checks, [.current, expanded])
        XCTAssertEqual(prompts, checks)
    }

    func testPromptIsDeferredInBackgroundButUnnecessaryPreparationCanFinish() async throws {
        let client = AuthorizationClientStub()
        await client.setForeground(false)
        let coordinator = coordinator(client)
        do {
            try await coordinator.prepare()
            XCTFail("Do not present HealthKit sheets in the background")
        } catch HealthKitAuthorizationPreparationError.requiresForeground { }
        let promptsBeforeForeground = await client.prompts
        XCTAssertTrue(promptsBeforeForeground.isEmpty)
        await client.setForeground(true)
        try await coordinator.prepare()
        await coordinator.invalidate()
        await client.setForeground(false)
        try await coordinator.prepare()
        let prompts = await client.prompts
        XCTAssertEqual(prompts.count, 1)
    }

    private func coordinator(_ client: AuthorizationClientStub) -> HealthKitAuthorizationCoordinator {
        HealthKitAuthorizationCoordinator(client: client, canPresent: { await client.foreground })
    }

    private func waitForPrompt(_ client: AuthorizationClientStub) async {
        let deadline = Date().addingTimeInterval(3)
        while Date() < deadline {
            if await client.isWaiting { return }
            await Task.yield()
        }
        XCTFail("Authorization prompt did not start")
    }
}

private actor AuthorizationClientStub: HealthKitAuthorizationClient {
    private(set) var checks: [HealthKitAuthorizationRequest] = []
    private(set) var prompts: [HealthKitAuthorizationRequest] = []
    private(set) var foreground = true
    var isWaiting: Bool { continuation != nil }
    private var status: HKAuthorizationRequestStatus = .shouldRequest
    private var workoutWriteStatus: HKAuthorizationStatus = .sharingAuthorized
    private var queryError: NSError?
    private var promptError: NSError?
    private var suspend = false
    private var continuation: CheckedContinuation<Void, Never>?

    func requestStatus(for request: HealthKitAuthorizationRequest) async throws -> HKAuthorizationRequestStatus {
        checks.append(request)
        if let queryError { throw queryError }
        return status
    }

    func requestAuthorization(for request: HealthKitAuthorizationRequest) async throws {
        prompts.append(request)
        if suspend { await withCheckedContinuation { continuation = $0 } }
        if let promptError { throw promptError }
        status = .unnecessary
    }

    func writeSnapshot() async -> HealthKitWriteAuthorizationSnapshot {
        HealthKitWriteAuthorizationSnapshot(workout: workoutWriteStatus, route: .sharingAuthorized,
                                            distance: .sharingAuthorized, energy: .sharingAuthorized,
                                            heartRate: .sharingAuthorized)
    }

    func setStatus(_ value: HKAuthorizationRequestStatus) { status = value }
    func setWorkoutWriteStatus(_ value: HKAuthorizationStatus) { workoutWriteStatus = value }
    func setQueryError(_ error: NSError?) { queryError = error }
    func setPromptError(_ error: NSError?) { promptError = error }
    func setForeground(_ value: Bool) { foreground = value }
    func suspendPrompt() { suspend = true }
    func resumePrompt() { suspend = false; continuation?.resume(); continuation = nil }
}
