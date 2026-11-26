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
struct ZeppWorkoutSyncResponse: Decodable, Sendable {
    let status: String
    let workoutCount: Int
    let startDate: String
    let endDate: String
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
                                Text("Envie os treinos de corrida de hoje e dos próximos seis dias. Depois, abra o Zepp para sincronizar com o relógio.")
                                    .foregroundStyle(.secondary)
                                Button("Enviar treinos planejados") {
                                    perform {
                                        let receipt = try await APIClient.shared.syncZepp()
                                        message = receipt.workoutCount == 0
                                            ? "Nenhum treino agendado nos próximos sete dias. A Zepp confirmou a limpeza dos treinos enviados para esse período."
                                            : "Zepp aceitou \(receipt.workoutCount) treino(s). Abra o Zepp, sincronize o relógio e confira os treinos antes de começar."
                                    }
                                }
                                if let date = status.lastSyncAt {
                                    Text("Último envio confirmado: \(formattedSyncDate(date))")
                                        .font(.footnote).foregroundStyle(.secondary)
                                }
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
    private func formattedSyncDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
        return date?.formatted(date: .abbreviated, time: .shortened) ?? value
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
