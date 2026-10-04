import Foundation

/// Tela "Relógio Garmin": parear pelo código mostrado no app Athly do relógio, acompanhar a
/// ativação e desconectar.
@MainActor
final class GarminConnectViewModel: ObservableObject {
    /// Chamadas de rede injetáveis (testes usam closures falsas).
    struct API: Sendable {
        var listDevices: @Sendable () async throws -> [ConnectIqDevice]
        var claim: @Sendable (String) async throws -> ConnectIqDevice
        var unpair: @Sendable (String) async throws -> Void

        static let live = API(
            listDevices: { try await APIClient.shared.listConnectIqDevices() },
            claim: { try await APIClient.shared.claimConnectIqPairing(code: $0) },
            unpair: { try await APIClient.shared.unpairConnectIqDevice(id: $0) }
        )
    }

    static let codeLength = 8

    @Published private(set) var devices: [ConnectIqDevice] = []
    @Published private(set) var code = ""
    @Published private(set) var isLoading = false
    @Published private(set) var isClaiming = false
    @Published private(set) var workingDeviceId: String?
    @Published var errorMessage: String?

    private let api: API
    private let pendingPollInterval: Duration
    private let pendingPollLimit: Int

    /// Depois do código confirmado, o relógio busca o token na consulta seguinte (a cada 5 s):
    /// a tela confere a cada 3 s, por até 1 min, até o relógio aparecer como ativo.
    init(api: API = .live, pendingPollInterval: Duration = .seconds(3), pendingPollLimit: Int = 20) {
        self.api = api
        self.pendingPollInterval = pendingPollInterval
        self.pendingPollLimit = pendingPollLimit
    }

    var canClaim: Bool { code.count == Self.codeLength && !isClaiming }

    var hasPendingDevice: Bool { devices.contains { !$0.isActive } }

    /// Só dígitos, no máximo 8 — aceita colar "4821 3907" ou "4821-3907".
    func updateCode(_ input: String) {
        code = String(input.filter { $0.isASCII && $0.isNumber }.prefix(Self.codeLength))
    }

    func load() async {
        isLoading = devices.isEmpty
        defer { isLoading = false }
        await refresh()
    }

    func claim() async {
        guard canClaim else { return }
        isClaiming = true
        errorMessage = nil
        defer { isClaiming = false }
        do {
            let device = try await api.claim(code)
            devices.removeAll { $0.id == device.id }
            devices.insert(device, at: 0)
            code = ""
        } catch {
            show(error)
        }
    }

    /// Roda enquanto houver relógio pendente; a view cancela ao sair da tela.
    func watchPendingDevices() async {
        var attempts = 0
        while hasPendingDevice, attempts < pendingPollLimit {
            do {
                try await Task.sleep(for: pendingPollInterval)
            } catch {
                return
            }
            attempts += 1
            await refresh()
        }
    }

    func unpair(_ device: ConnectIqDevice) async {
        workingDeviceId = device.id
        errorMessage = nil
        defer { workingDeviceId = nil }
        do {
            try await api.unpair(device.id)
            devices.removeAll { $0.id == device.id }
        } catch {
            show(error)
        }
    }

    private func refresh() async {
        do {
            devices = try await api.listDevices()
        } catch {
            show(error)
        }
    }

    private func show(_ error: Error) {
        if error is CancellationError { return }
        if let urlError = error as? URLError, urlError.code == .cancelled { return }
        errorMessage = error.localizedDescription
    }
}
