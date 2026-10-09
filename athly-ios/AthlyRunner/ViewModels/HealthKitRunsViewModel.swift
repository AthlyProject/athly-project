import Foundation
import SwiftUI
import os

@MainActor
final class HealthKitRunsViewModel: ObservableObject {

    enum State {
        case idle
        case loading
        case loaded([HealthKitRunItem])
        case error(String)
        case healthUnavailable
    }

    @Published private(set) var revision = 0
    @Published private(set) var state: State = .idle { didSet { revision += 1 } }
    @Published private(set) var linkedRunsById: [String: HealthKitRunItem] = [:] { didSet { revision += 1 } }
    @Published private(set) var isRefreshing = false
    @Published private(set) var isLoadingMore = false
    @Published private(set) var isResolvingLinkedRuns = false
    @Published private(set) var canLoadMore = true
    @Published private(set) var cacheUpdatedAt: Date?

    #if DEBUG
    @Published private(set) var isRunningZeppDiagnostic = false
    @Published private(set) var zeppDiagnosticMessage: String?
    #endif

    private let healthKitService: any HealthKitRunningWorkoutsProviding
    private let cache: any HealthKitRunsCaching
    private var loadTask: Task<Void, Never>?
    private var lastLoaded: Date?
    private var resolvingIDs = Set<String>()
    private let pageSize: Int
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")

    init(
        healthKitService: any HealthKitRunningWorkoutsProviding = HealthKitService(),
        cache: any HealthKitRunsCaching = HealthKitRunsCache.shared,
        pageSize: Int = 20
    ) {
        self.healthKitService = healthKitService
        self.cache = cache
        self.pageSize = max(1, pageSize)
    }

    var runs: [HealthKitRunItem] {
        if case .loaded(let items) = state { return items }
        return []
    }

    var allKnownRuns: [HealthKitRunItem] {
        var byId = Dictionary(uniqueKeysWithValues: runs.map { ($0.id, $0) })
        for (id, item) in linkedRunsById {
            byId[id] = item
        }
        return Self.sorted(Array(byId.values))
    }

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    var isInitialLoading: Bool {
        isLoading && !hasKnownRuns
    }

    var hasKnownRuns: Bool {
        !runs.isEmpty || !linkedRunsById.isEmpty
    }

    var errorMessage: String? {
        if case .error(let message) = state { return message }
        return nil
    }

    var isHealthUnavailable: Bool {
        if case .healthUnavailable = state { return true }
        return false
    }

    /// True quando a carga terminou e a lista de corridas está vazia.
    var isEmptyAfterLoad: Bool {
        guard case .loaded(let items) = state else { return false }
        return items.isEmpty && !isRefreshing && !isLoadingMore && !isResolvingLinkedRuns
    }

    func loadWorkouts(force: Bool = true) async {
        if let loadTask { await loadTask.value; return }
        if !force, let lastLoaded, Date().timeIntervalSince(lastLoaded) < 60 { return }
        let task = Task { await self.performLoad() }
        loadTask = task
        await task.value
        loadTask = nil
    }

    private func performLoad() async {
        let session = await APIClient.shared.heartRateSessionIdentifier
        await hydrateFromCacheIfNeeded()
        guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }

        guard healthKitService.isHealthDataAvailable else {
            if !hasKnownRuns {
                state = .healthUnavailable
            }
            return
        }

        if hasKnownRuns {
            isRefreshing = true
        } else {
            state = .loading
        }
        defer { isRefreshing = false }

        do {
            try await healthKitService.requestReadAuthorization()
            let items = try await healthKitService.fetchRunningWorkoutSummariesPage(limit: pageSize, beforeEndDate: nil)
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            setRuns(Self.merged(existing: runs, incoming: items))
            removeLinkedRunsDuplicatedByMainList()
            canLoadMore = items.count == pageSize
            persistCache()
            lastLoaded = Date()
            isRefreshing = false
            let enriched = try await healthKitService.enrichHeartRates(items)
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            setRuns(Self.merged(existing: runs, incoming: enriched))
            persistCache()
        } catch let error as HealthKitError {
            switch error {
            case .notAvailable:
                if !hasKnownRuns {
                    state = .healthUnavailable
                }
            case .writeDenied,
                 .workoutNotReturned,
                 .workoutNotFound,
                 .importedRouteMissing,
                 .importedWorkoutMismatch,
                 .routeWriteDenied,
                 .routeNotReturned,
                 .routeAttachmentFailed,
                 .workoutDeleteFailed:
                if !hasKnownRuns {
                    state = .error(error.localizedDescription)
                }
            }
        } catch {
            if !hasKnownRuns {
                state = .error(error.localizedDescription)
            }
        }
    }

    func retry() {
        state = .idle
        Task { await loadWorkouts() }
    }

    func ensureRunItems(workoutUUIDs: [String]) async {
        guard healthKitService.isHealthDataAvailable else { return }
        let requested = Set(workoutUUIDs.filter { !$0.isEmpty })
        guard !requested.isEmpty else { return }

        let known = Set(runs.map(\.id)).union(linkedRunsById.keys)
        let missing = requested.subtracting(known).subtracting(resolvingIDs)
        guard !missing.isEmpty else { return }

        resolvingIDs.formUnion(missing)
        isResolvingLinkedRuns = true
        defer {
            resolvingIDs.subtract(missing)
            isResolvingLinkedRuns = !resolvingIDs.isEmpty
        }
        let session = await APIClient.shared.heartRateSessionIdentifier

        let service = healthKitService
        let fetchedItems = await withTaskGroup(of: (String, HealthKitRunItem?).self) { group in
            let ids = Array(missing)
            var next = 0
            func enqueue(_ uuid: String) {
                group.addTask { (uuid, try? await service.fetchRunningWorkout(uuid: uuid)) }
            }
            while next < min(4, ids.count) { enqueue(ids[next]); next += 1 }
            var results: [(String, HealthKitRunItem)] = []
            for await (uuid, item) in group {
                if let item { results.append((uuid, item)) }
                if next < ids.count { enqueue(ids[next]); next += 1 }
            }
            return results
        }

        guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
        for (uuid, item) in fetchedItems {
            linkedRunsById[uuid] = item
        }
        removeLinkedRunsDuplicatedByMainList()
        persistCache()
    }

    func loadMoreIfNeeded(currentItem: HealthKitRunItem) async {
        guard shouldLoadMore(currentItem: currentItem) else { return }
        await loadMore()
    }

    private func loadMore() async {
        guard !isLoadingMore,
              canLoadMore,
              healthKitService.isHealthDataAvailable,
              let cursor = runs.last?.endDate else {
            return
        }

        isLoadingMore = true
        defer { isLoadingMore = false }
        let session = await APIClient.shared.heartRateSessionIdentifier

        do {
            let items = try await healthKitService.fetchRunningWorkoutSummariesPage(limit: pageSize, beforeEndDate: cursor)
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            if items.isEmpty {
                canLoadMore = false
                return
            }
            setRuns(Self.merged(existing: runs, incoming: items))
            removeLinkedRunsDuplicatedByMainList()
            canLoadMore = items.count == pageSize
            persistCache()
            let enriched = try await healthKitService.enrichHeartRates(items)
            guard session == (await APIClient.shared.heartRateSessionIdentifier) else { return }
            setRuns(Self.merged(existing: runs, incoming: enriched))
            persistCache()
        } catch {
            // Pagination is best-effort; keep the visible cached/current list intact.
        }
    }

    private func shouldLoadMore(currentItem: HealthKitRunItem) -> Bool {
        guard canLoadMore,
              !isInitialLoading,
              !isRefreshing,
              !isLoadingMore,
              !runs.isEmpty,
              let index = runs.firstIndex(where: { $0.id == currentItem.id }) else {
            return false
        }
        let thresholdIndex = max(runs.count - 5, 0)
        return index >= thresholdIndex
    }

    private func hydrateFromCacheIfNeeded() async {
        guard !hasKnownRuns, let snapshot = await cache.loadFromDisk() else { return }
        linkedRunsById = snapshot.linkedRunsById
        cacheUpdatedAt = snapshot.updatedAt
        canLoadMore = snapshot.runs.count >= pageSize
        setRuns(snapshot.runs)
    }

    private func setRuns(_ items: [HealthKitRunItem]) {
        let sorted = Self.sorted(items)
        if case .loaded(let current) = state, current == sorted { return }
        state = .loaded(sorted)
    }

    private func removeLinkedRunsDuplicatedByMainList() {
        let runIds = Set(runs.map(\.id))
        linkedRunsById = linkedRunsById.filter { !runIds.contains($0.key) }
    }

    private func persistCache() {
        cacheUpdatedAt = Date()
        cache.save(
            HealthKitRunsCacheSnapshot(
                runs: runs,
                linkedRunsById: linkedRunsById,
                updatedAt: cacheUpdatedAt ?? Date()
            )
        )
    }

    private static func merged(existing: [HealthKitRunItem], incoming: [HealthKitRunItem]) -> [HealthKitRunItem] {
        var byId = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        for item in incoming {
            byId[item.id] = item
        }
        return sorted(Array(byId.values))
    }

    private static func sorted(_ items: [HealthKitRunItem]) -> [HealthKitRunItem] {
        items.sorted {
            if $0.endDate == $1.endDate {
                return $0.id < $1.id
            }
            return $0.endDate > $1.endDate
        }
    }

    #if DEBUG
    func runZeppDiagnostic() async {
        guard !isRunningZeppDiagnostic else { return }
        guard healthKitService.isHealthDataAvailable else {
            zeppDiagnosticMessage = String(localized: "HealthKit indisponivel neste dispositivo.")
            return
        }

        isRunningZeppDiagnostic = true
        zeppDiagnosticMessage = String(localized: "Rodando diagnostico Zepp...")
        defer { isRunningZeppDiagnostic = false }

        do {
            try await healthKitService.requestReadAuthorization()
            await healthKitService.diagnoseZeppWorkouts(limit: 10)
            zeppDiagnosticMessage = String(localized: "Diagnostico Zepp enviado para os logs do Xcode.")
        } catch {
            zeppDiagnosticMessage = String(localized: "Falha no diagnostico Zepp:") + " \(error.localizedDescription)"
        }
    }
    #endif
}
