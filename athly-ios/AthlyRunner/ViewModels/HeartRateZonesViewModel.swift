import Foundation
import Combine

@MainActor
final class HeartRateZonesViewModel: ObservableObject {
    @Published private(set) var zones: HeartRateZones?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var syncMessage: String?

    private let api: APIClient
    private let health: any HeartRateHealthProviding
    private let syncHistory: (@MainActor @Sendable () async -> Void)?
    private var task: Task<Void, Never>?
    private var generation = UUID()
    private var lastRefresh: Date?

    convenience init() {
        self.init(api: .shared, health: HealthKitService(), syncHistory: {
            await PlannerHealthSyncService.shared.sync()
        })
    }

    init(api: APIClient, health: any HeartRateHealthProviding = HealthKitService(),
         syncHistory: (@MainActor @Sendable () async -> Void)? = nil) {
        self.api = api
        self.health = health
        self.syncHistory = syncHistory
    }

    func cancel(clear: Bool = false) {
        generation = UUID()
        task?.cancel()
        task = nil
        isLoading = false
        if clear { lastRefresh = nil; zones = nil; errorMessage = nil; syncMessage = nil }
    }

    func refreshIfNeeded() async {
        if let lastRefresh, Date().timeIntervalSince(lastRefresh) < 60 { return }
        await refresh()
    }

    func refresh(syncHealth: Bool = true, requestAuthorization: Bool = false) async {
        cancel()
        let current = generation
        isLoading = true
        errorMessage = nil
        syncMessage = nil
        let work = Task { [weak self] in
            guard let self else { return }
            defer { if self.generation == current { self.isLoading = false; self.task = nil } }
            let session = await self.api.heartRateSessionIdentifier
            guard await self.api.isAuthenticated, self.generation == current, !Task.isCancelled else { return }
            do {
                let saved = try await self.api.getHeartRateZones(session: session)
                try Task.checkCancellation()
                guard self.generation == current else { return }
                self.zones = saved
                self.lastRefresh = Date()
                guard syncHealth else { return }

                let snapshot: HeartRateHealthSnapshot?
                do {
                    if requestAuthorization { try await self.health.requestHeartRateReadAuthorization() }
                    if let syncHistory = self.syncHistory {
                        await syncHistory()
                        try Task.checkCancellation()
                        guard self.generation == current else { return }
                        let updated = try await self.api.getHeartRateZones(session: session)
                        try Task.checkCancellation()
                        guard self.generation == current else { return }
                        self.zones = updated
                    }
                    snapshot = try await self.health.fetchRestingHeartRate()
                } catch is CancellationError { return }
                catch {
                    if self.generation == current, requestAuthorization {
                        self.syncMessage = String(localized: "Não foi possível ler o Apple Health. Tente sincronizar novamente.")
                    }
                    return
                }
                try Task.checkCancellation()
                guard self.generation == current else { return }
                guard let snapshot else {
                    if requestAuthorization {
                        self.syncMessage = String(localized: "Nenhuma FC de repouso disponível no Apple Health nos últimos 30 dias. Verifique os dados e o acesso no app Saúde, ou informe um valor no perfil.")
                    }
                    return
                }
                let updated = try await self.api.syncHeartRateHealth(snapshot, session: session)
                try Task.checkCancellation()
                guard self.generation == current else { return }
                self.zones = updated
            } catch is CancellationError { /* Session changed or a newer refresh superseded this one. */ }
            catch {
                guard self.generation == current else { return }
                self.errorMessage = String(localized: "Não foi possível atualizar suas zonas. Tente novamente.")
            }
        }
        task = work
        await withTaskCancellationHandler {
            await work.value
        } onCancel: {
            work.cancel()
        }
    }
}
