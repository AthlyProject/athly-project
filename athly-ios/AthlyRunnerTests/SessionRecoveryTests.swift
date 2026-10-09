import XCTest
@testable import AthlyRunner

private actor SessionGate {
    private var open = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if open { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func release() {
        open = true
        waiters.forEach { $0.resume() }
        waiters.removeAll()
    }
}

private final class MemorySessionStore: @unchecked Sendable {
    private let lock = NSLock()
    private var value: SessionTokens?
    private var failures = 0
    var tokens: SessionTokens? { lock.withLock { value } }
    func failNextSave() { lock.withLock { failures += 1 } }
    func save(_ tokens: SessionTokens) throws {
        try lock.withLock {
            if failures > 0 { failures -= 1; throw SessionStorageError() }
            value = tokens
        }
    }
    func clear() { lock.withLock { value = nil } }
}

private actor SessionServer {
    let started = SessionGate()
    let releaseRefresh = SessionGate()
    let oldRequestsReady = SessionGate()
    let releaseLateResponse = SessionGate()
    var refreshCount = 0
    var oldCount = 0
    var refreshStatus = 200
    var retryStatus = 200
    var refreshError: URLError.Code?
    var malformedRefresh = false
    var holdRefresh = false
    var holdLateResponse = false
    var expectedOldRequests = 1

    func configure(refreshStatus: Int = 200, retryStatus: Int = 200,
                   error: URLError.Code? = nil, malformed: Bool = false,
                   hold: Bool = false, late: Bool = false, oldRequests: Int = 1) {
        self.refreshStatus = refreshStatus
        self.retryStatus = retryStatus
        refreshError = error
        malformedRefresh = malformed
        holdRefresh = hold
        holdLateResponse = late
        expectedOldRequests = oldRequests
    }

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let path = request.url!.path
        if path == "/auth/refresh" {
            refreshCount += 1
            await started.release()
            if holdRefresh { await releaseRefresh.wait() }
            if let refreshError { throw URLError(refreshError) }
            return response(request, refreshStatus, malformedRefresh ? "broken" :
                #"{"accessToken":"new-access","refreshToken":"new-refresh"}"#)
        }
        if request.value(forHTTPHeaderField: "Authorization") == "Bearer old-access" {
            oldCount += 1
            if oldCount >= expectedOldRequests { await oldRequestsReady.release() }
            if holdLateResponse && path == "/goals/active" { await releaseLateResponse.wait() }
            return response(request, 401, "{}")
        }
        if path == "/goals/active" { return response(request, retryStatus == 200 ? 404 : retryStatus, "{}") }
        return response(request, retryStatus, #"{"id":"user-1","email":"runner@example.com"}"#)
    }

    private func response(_ request: URLRequest, _ status: Int, _ body: String) -> (Data, URLResponse) {
        (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
    }
}

private final class SessionExpiryLog: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [UUID] = []
    var versions: [UUID] { lock.withLock { values } }
    func append(_ version: UUID) { lock.withLock { values.append(version) } }
}

final class SessionRecoveryTests: XCTestCase {
    private func client(_ server: SessionServer, _ store: MemorySessionStore) async -> APIClient {
        let api = APIClient(transport: { try await server.send($0) },
                            persistTokens: { try store.save($0) }, deleteTokens: { store.clear() })
        await api.setTokens(access: "old-access", refresh: "old-refresh")
        return api
    }

    func testConcurrentRequiredAndOptionalRequestsShareRefreshAndPersistBeforeRetry() async throws {
        let server = SessionServer(), store = MemorySessionStore()
        await server.configure(hold: true, oldRequests: 4)
        let api = await client(server, store)
        let calls = (0..<4).map { index in Task {
            if index.isMultiple(of: 2) { _ = try await api.getUserProfile() }
            else { _ = try await api.getActiveGoal() }
            XCTAssertEqual(store.tokens?.refreshToken, "new-refresh")
        } }
        await server.oldRequestsReady.wait()
        await server.started.wait()
        await server.releaseRefresh.release()
        for call in calls { try await call.value }
        let count = await server.refreshCount
        XCTAssertEqual(count, 1)
        XCTAssertEqual(store.tokens, SessionTokens(accessToken: "new-access", refreshToken: "new-refresh"))

        let restored = APIClient(transport: { try await server.send($0) }, persistTokens: { try store.save($0) }, deleteTokens: {})
        let saved = try XCTUnwrap(store.tokens)
        await restored.setTokens(access: saved.accessToken, refresh: saved.refreshToken)
        let profile = try await restored.getUserProfile()
        XCTAssertEqual(profile.id, "user-1")
        let afterRestart = await server.refreshCount
        XCTAssertEqual(afterRestart, 1)
    }

    func testLate401UsesAlreadyRefreshedToken() async throws {
        let server = SessionServer(), store = MemorySessionStore()
        await server.configure(hold: true, late: true, oldRequests: 2)
        let api = await client(server, store)
        let optional = Task { try await api.getActiveGoal() }
        let required = Task { try await api.getUserProfile() }
        await server.oldRequestsReady.wait()
        await server.started.wait()
        await server.releaseRefresh.release()
        _ = try await required.value
        await server.releaseLateResponse.release()
        let missing = try await optional.value
        XCTAssertNil(missing)
        let count = await server.refreshCount
        XCTAssertEqual(count, 1)
    }

    func testTransientRefreshFailuresKeepSessionAndAllowRetry() async throws {
        for failure in [URLError.notConnectedToInternet, .timedOut, .cancelled] {
            let server = SessionServer(), store = MemorySessionStore()
            let api = await client(server, store)
            await server.configure(error: failure)
            do { _ = try await api.getUserProfile(); XCTFail("Expected network failure") }
            catch let error as URLError { XCTAssertEqual(error.code, failure) }
            let authenticated = await api.isAuthenticated
            XCTAssertTrue(authenticated)
            await server.configure()
            _ = try await api.getUserProfile()
            XCTAssertEqual(store.tokens?.refreshToken, "new-refresh")
        }
    }

    func testServerAndDecodeErrorsDoNotBecomeUnauthorized() async throws {
        for malformed in [false, true] {
            let server = SessionServer(), store = MemorySessionStore()
            await server.configure(refreshStatus: malformed ? 200 : 500, malformed: malformed)
            let api = await client(server, store)
            do { _ = try await api.getUserProfile(); XCTFail("Expected failure") }
            catch APIError.unauthorized { XCTFail("Transient failure ended session") }
            catch { }
            let authenticated = await api.isAuthenticated
            XCTAssertTrue(authenticated)
        }
    }

    func testRetryPreservesServerErrorAndOptional404() async throws {
        let server = SessionServer(), store = MemorySessionStore()
        let api = await client(server, store)
        await server.configure(retryStatus: 500)
        do { _ = try await api.getUserProfile(); XCTFail("Expected failure") }
        catch APIError.serverError(let code, _) { XCTAssertEqual(code, 500) }
        await server.configure()
        let missing = try await api.getActiveGoal()
        XCTAssertNil(missing)
    }

    func testKeychainFailureRetainsRotatedPairForNextPersistenceAttempt() async throws {
        let server = SessionServer(), store = MemorySessionStore()
        let api = await client(server, store)
        store.failNextSave()
        do { _ = try await api.getUserProfile(); XCTFail("Expected storage failure") }
        catch is SessionStorageError { }
        _ = try await api.getUserProfile()
        XCTAssertEqual(store.tokens?.refreshToken, "new-refresh")
        let count = await server.refreshCount
        XCTAssertEqual(count, 1)
    }

    func testLogoutOrAccountSwitchDiscardsInFlightRefresh() async throws {
        for switchAccount in [false, true] {
            let server = SessionServer(), store = MemorySessionStore()
            await server.configure(hold: true)
            let api = await client(server, store)
            let call = Task { try await api.getUserProfile() }
            await server.started.wait()
            if switchAccount { await api.setTokens(access: "other-access", refresh: "other-refresh") }
            else { await api.clearTokens() }
            await server.releaseRefresh.release()
            do { _ = try await call.value; XCTFail("Stale refresh succeeded") }
            catch is CancellationError { }
            XCTAssertNil(store.tokens)
            let authenticated = await api.isAuthenticated
            XCTAssertEqual(authenticated, switchAccount)
        }
    }

    func testTransientFailureDoesNotNotifyLogoutAndStaleExpiryCannotClearNewAccount() async throws {
        let log = SessionExpiryLog()
        let observer = NotificationCenter.default.addObserver(forName: .athlySessionExpired, object: nil, queue: nil) {
            if let version = $0.userInfo?["sessionVersion"] as? UUID { log.append(version) }
        }
        defer { NotificationCenter.default.removeObserver(observer) }
        let server = SessionServer(), store = MemorySessionStore()
        let api = await client(server, store)
        await server.configure(refreshStatus: 500)
        do { _ = try await api.getUserProfile(); XCTFail("Expected failure") } catch { }
        XCTAssertTrue(log.versions.isEmpty)
        await server.configure(refreshStatus: 401)
        for _ in 0..<2 {
            do { _ = try await api.getUserProfile(); XCTFail("Expected rejection") }
            catch APIError.unauthorized { }
        }
        XCTAssertEqual(log.versions.count, 1)
        let expired = try XCTUnwrap(log.versions.first)
        await api.setTokens(access: "other-access", refresh: "other-refresh")
        let cleared = await api.clearTokens(ifVersion: expired)
        XCTAssertFalse(cleared)
        let authenticated = await api.isAuthenticated
        XCTAssertTrue(authenticated)
    }

    func testDefinitiveRejectionsReportUnauthorized() async throws {
        for refreshRejected in [false, true] {
            let server = SessionServer(), store = MemorySessionStore()
            await server.configure(refreshStatus: refreshRejected ? 401 : 200, retryStatus: 401)
            let api = await client(server, store)
            do { _ = try await api.getUserProfile(); XCTFail("Expected rejection") }
            catch APIError.unauthorized { }
        }
    }
}

final class SessionTokenMigrationTests: XCTestCase {
    func testMigratesLegacyKeychainOrDefaultsOnlyAfterSavingPair() throws {
        for fromKeychain in [false, true] {
            let legacy = ["athly_access_token": "access", "athly_refresh_token": "refresh"]
            var stored: SessionTokens?
            var cleared = false
            let result = try SessionTokenStore.load(
                read: { fromKeychain ? legacy[$0] : nil },
                readLegacyDefault: { fromKeychain ? nil : legacy[$0] },
                save: { stored = $0 },
                clearLegacy: { XCTAssertNotNil(stored); cleared = true }
            )
            XCTAssertEqual(result, SessionTokens(accessToken: "access", refreshToken: "refresh"))
            XCTAssertEqual(stored, result)
            XCTAssertTrue(cleared)
        }
    }

    func testFailedMigrationRetainsLegacyAndCanRetry() throws {
        let legacy = ["athly_access_token": "access", "athly_refresh_token": "refresh"]
        var cleared = false
        XCTAssertThrowsError(try SessionTokenStore.load(
            read: { legacy[$0] }, readLegacyDefault: { _ in nil },
            save: { _ in throw SessionStorageError() }, clearLegacy: { cleared = true }
        ))
        XCTAssertFalse(cleared)
        let result = try SessionTokenStore.load(read: { legacy[$0] }, readLegacyDefault: { _ in nil },
                                                save: { _ in }, clearLegacy: { cleared = true })
        XCTAssertNotNil(result)
        XCTAssertTrue(cleared)
    }

    func testNeverMixesPartialKeychainPairWithDefaults() throws {
        let result = try SessionTokenStore.load(
            read: { $0 == "athly_access_token" ? "new-access" : nil },
            readLegacyDefault: { $0 == "athly_refresh_token" ? "old-refresh" : nil },
            save: { _ in XCTFail("Mixed sessions") }, clearLegacy: { XCTFail("Lost legacy tokens") }
        )
        XCTAssertNil(result)
    }

    func testExistingPairWinsOverStaleLegacyCredentials() throws {
        let tokens = SessionTokens(accessToken: "new-access", refreshToken: "new-refresh")
        let encoded = String(decoding: try JSONEncoder().encode(tokens), as: UTF8.self)
        let result = try SessionTokenStore.load(
            read: { $0 == "athly_session_tokens" ? encoded : "old-token" },
            readLegacyDefault: { _ in "old-token" }, save: { _ in XCTFail("Replaced current session") }, clearLegacy: {}
        )
        XCTAssertEqual(result, tokens)
    }

    func testKeychainUpdateKeepsPairReadableAcrossReplacement() throws {
        let key = "session-test-\(UUID().uuidString)"
        defer { KeychainHelper.delete(key) }
        for token in ["first", "rotated"] {
            let pair = SessionTokens(accessToken: token, refreshToken: "\(token)-refresh")
            let encoded = String(decoding: try JSONEncoder().encode(pair), as: UTF8.self)
            XCTAssertTrue(KeychainHelper.save(encoded, for: key))
            let read = try XCTUnwrap(KeychainHelper.readValue(key))
            XCTAssertEqual(try JSONDecoder().decode(SessionTokens.self, from: Data(read.utf8)), pair)
        }
    }
}
