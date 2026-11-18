import SwiftUI

struct ZeppStatus: Decodable, Sendable {
    let enabled: Bool
    let connected: Bool
    let lastSyncAt: String?
    let error: String?
    let workoutsEnabled: Bool?
    let historyImportAvailable: Bool?
    let backfillRequestId: String?
    let backfillError: String?
}
struct ZeppBackfillResponse: Decodable, Sendable {
    let requestId: String
    let status: String
}
struct ZeppAuthorization: Decodable { let url: URL }
struct ZeppActivity: Decodable, Identifiable, Sendable { let id: String }

struct ZeppConnectView: View {
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @State private var status: ZeppStatus?
    @State private var error: String?
    @State private var busy = false
    @State private var refreshing = false
    @State private var message: String?

    var body: some View {
        List {
            Section {
                Text("Grave a corrida no Amazfit e sincronize o relógio pelo Zepp. Depois, confirme a atividade na Athly.")
                if let status {
                    Text(status.connected ? "Conectado" : "Não conectado")
                    if !status.enabled { Text("Integração Zepp temporariamente indisponível.") }
                    if status.workoutsEnabled == true, let message = status.error { Text(message).foregroundStyle(.orange) }
                    if status.enabled {
                        if status.connected {
                            Text("Para vincular uma corrida, abra o workout planejado e escolha Concluir treino ou Adicionar dados.")
                            if status.workoutsEnabled == true {
                                Button("Enviar treinos planejados") { perform { try await APIClient.shared.syncZepp() } }
                            }
                            Button("Desconectar", role: .destructive) { perform { try await APIClient.shared.disconnectZepp() } }
                        } else {
                            Button("Conectar ao Zepp") {
                                perform {
                                    let authorization = try await APIClient.shared.authorizeZepp()
                                    openURL(authorization.url)
                                }
                            }
                        }
                    }
                } else if refreshing {
                    ProgressView("Consultando conexão…")
                } else {
                    Text("Não foi possível consultar a conexão.")
                }
                if busy { ProgressView() }
                if let message { Text(message).foregroundStyle(.secondary) }
                if let error { Text(error).foregroundStyle(.red) }
                Button("Atualizar conexão") { Task { await refresh() } }
                    .disabled(refreshing)
            }
            Section {
                Text("Sincronize o relógio pelo Zepp após a corrida. Você poderá vincular o resultado a um treino, salvar como corrida livre ou ignorar.")
            }
        }
        .navigationTitle("Amazfit / Zepp")
        .disabled(busy)
        .task { await refresh() }
        .refreshable { await refresh() }
        .onChange(of: scenePhase) { phase in
            if phase == .active { Task { await refresh() } }
        }
    }
    @MainActor private func refresh() async {
        guard !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        do { status = try await APIClient.shared.zeppStatus(); error = nil }
        catch { self.error = error.localizedDescription }
    }
    @MainActor private func perform(_ action: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }
        busy = true
        error = nil
        message = nil
        Task {
            defer { busy = false }
            do { try await action(); await refresh() }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct ZeppCandidatePage: Decodable { let items: [ZeppActivity]; let nextCursor: String? }
