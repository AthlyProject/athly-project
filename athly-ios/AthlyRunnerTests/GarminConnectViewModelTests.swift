import XCTest
@testable import AthlyRunner

/// Pareamento do relógio Garmin: código só com dígitos, confirmação, acompanhamento do relógio
/// pendente e desconexão, com a API trocada por closures.
@MainActor
final class GarminConnectViewModelTests: XCTestCase {

    func testUpdateCodeKeepsOnlyEightAsciiDigits() {
        let viewModel = GarminConnectViewModel(api: .stub())

        viewModel.updateCode("4821 3907")
        XCTAssertEqual(viewModel.code, "48213907")
        XCTAssertTrue(viewModel.canClaim)

        viewModel.updateCode("4821-3907-99")
        XCTAssertEqual(viewModel.code, "48213907")

        viewModel.updateCode("１２３４") // dígitos de largura total não são aceitos pelo backend
        XCTAssertEqual(viewModel.code, "")
        XCTAssertFalse(viewModel.canClaim)
    }

    func testClaimAddsPendingDeviceAndClearsCode() async {
        let claimed = Recorder()
        let viewModel = GarminConnectViewModel(api: .stub(claim: { code in
            claimed.append(code)
            return device("device-1", status: "pending")
        }))
        viewModel.updateCode("4821 3907")

        await viewModel.claim()

        XCTAssertEqual(claimed.values, ["48213907"])
        XCTAssertEqual(viewModel.devices.map(\.id), ["device-1"])
        XCTAssertTrue(viewModel.hasPendingDevice)
        XCTAssertEqual(viewModel.code, "")
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertFalse(viewModel.isClaiming)
    }

    func testClaimDoesNothingWithIncompleteCode() async {
        let claimed = Recorder()
        let viewModel = GarminConnectViewModel(api: .stub(claim: { code in
            claimed.append(code)
            return device("device-1")
        }))
        viewModel.updateCode("4821")

        await viewModel.claim()

        XCTAssertEqual(claimed.values, [])
    }

    func testClaimFailureKeepsCodeAndShowsMessage() async {
        let viewModel = GarminConnectViewModel(api: .stub(claim: { _ in throw StubError() }))
        viewModel.updateCode("48213907")

        await viewModel.claim()

        XCTAssertEqual(viewModel.errorMessage, StubError().errorDescription)
        XCTAssertEqual(viewModel.code, "48213907")
        XCTAssertTrue(viewModel.devices.isEmpty)
    }

    func testWatchPendingStopsWhenWatchActivates() async {
        let calls = Recorder()
        let viewModel = GarminConnectViewModel(
            api: .stub(
                list: {
                    calls.append("list")
                    return [device("device-1", status: calls.values.count < 3 ? "pending" : "active")]
                },
                claim: { _ in device("device-1", status: "pending") }
            ),
            pendingPollInterval: .milliseconds(1)
        )
        viewModel.updateCode("48213907")
        await viewModel.claim()

        await viewModel.watchPendingDevices()

        XCTAssertEqual(calls.values.count, 3)
        XCTAssertFalse(viewModel.hasPendingDevice)
    }

    func testWatchPendingGivesUpAfterLimit() async {
        let calls = Recorder()
        let viewModel = GarminConnectViewModel(
            api: .stub(
                list: {
                    calls.append("list")
                    return [device("device-1", status: "pending")]
                },
                claim: { _ in device("device-1", status: "pending") }
            ),
            pendingPollInterval: .milliseconds(1),
            pendingPollLimit: 3
        )
        viewModel.updateCode("48213907")
        await viewModel.claim()

        await viewModel.watchPendingDevices()

        XCTAssertEqual(calls.values.count, 3)
        XCTAssertTrue(viewModel.hasPendingDevice)
    }

    func testUnpairRemovesOnlyThatDevice() async {
        let unpaired = Recorder()
        let viewModel = GarminConnectViewModel(api: .stub(
            list: { [device("device-1"), device("device-2")] },
            unpair: { id in unpaired.append(id) }
        ))
        await viewModel.load()

        await viewModel.unpair(viewModel.devices[0])

        XCTAssertEqual(unpaired.values, ["device-1"])
        XCTAssertEqual(viewModel.devices.map(\.id), ["device-2"])
        XCTAssertNil(viewModel.workingDeviceId)
    }

    func testCancelledLoadIsNotShownAsError() async {
        let viewModel = GarminConnectViewModel(api: .stub(list: { throw CancellationError() }))

        await viewModel.load()

        XCTAssertNil(viewModel.errorMessage)
    }

    func testDecodesDeviceFromBackend() throws {
        let json = """
        {
          "id": "47adbdd7-6acd-4fbf-9a4b-9822f4f26de7",
          "status": "active",
          "partNumber": "006-B4432-00",
          "appVersion": "1.0.0",
          "pairedAt": "2026-10-04T13:54:23.951Z",
          "lastSeenAt": "2026-10-04T13:55:00.000Z",
          "lastSyncAt": "2026-10-04T13:55:00.120Z",
          "lastSync": { "downloaded": 2, "removed": 0, "failed": 0, "storageFull": false, "syncedIds": ["a", "b"] }
        }
        """
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        let decoded = try decoder.decode(ConnectIqDevice.self, from: Data(json.utf8))

        XCTAssertTrue(decoded.isActive)
        XCTAssertEqual(decoded.lastSync?.syncedIds, ["a", "b"])
        XCTAssertEqual(decoded.lastSyncDate?.timeIntervalSince1970 ?? 0, 1_791_122_100.12, accuracy: 0.001)
    }
}

private func device(_ id: String, status: String = "active") -> ConnectIqDevice {
    ConnectIqDevice(
        id: id,
        status: status,
        partNumber: "006-B4432-00",
        appVersion: "1.0.0",
        pairedAt: "2026-10-04T13:54:23.951Z",
        lastSeenAt: nil,
        lastSyncAt: nil,
        lastSync: nil
    )
}

private struct StubError: LocalizedError {
    var errorDescription: String? { "Código inválido ou expirado." }
}

/// Registro thread-safe para as closures `@Sendable` da API falsa.
private final class Recorder: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: [String] = []

    func append(_ value: String) {
        lock.lock()
        stored.append(value)
        lock.unlock()
    }

    var values: [String] {
        lock.lock()
        defer { lock.unlock() }
        return stored
    }
}

private extension GarminConnectViewModel.API {
    static func stub(
        list: @escaping @Sendable () async throws -> [ConnectIqDevice] = { [] },
        claim: @escaping @Sendable (String) async throws -> ConnectIqDevice = { _ in throw URLError(.badServerResponse) },
        unpair: @escaping @Sendable (String) async throws -> Void = { _ in }
    ) -> Self {
        Self(listDevices: list, claim: claim, unpair: unpair)
    }
}
