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

    @Published private(set) var state: State = .idle
    @Published private(set) var linkedRunsById: [String: HealthKitRunItem] = [:]
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

    func loadWorkouts() async {
        hydrateFromCacheIfNeeded()

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
            let items = try await healthKitService.fetchRunningWorkoutsPage(limit: pageSize, beforeEndDate: nil)
            setRuns(Self.merged(existing: runs, incoming: items))
            removeLinkedRunsDuplicatedByMainList()
            canLoadMore = items.count == pageSize
            persistCache()
            scheduleDiagnostics(for: items)
        } catch let error as HealthKitError {
            switch error {
            case .notAvailable:
                if !hasKnownRuns {
                    state = .healthUnavailable
                }
            case .writeDenied:
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
        let missing = requested.subtracting(known)
        guard !missing.isEmpty else { return }

        isResolvingLinkedRuns = true
        defer { isResolvingLinkedRuns = false }

        let service = healthKitService
        let fetchedItems = await withTaskGroup(of: (String, HealthKitRunItem?).self) { group in
            for uuid in missing {
                group.addTask {
                    (uuid, try? await service.fetchRunningWorkout(uuid: uuid))
                }
            }

            var results: [(String, HealthKitRunItem)] = []
            for await (uuid, item) in group {
                if let item {
                    results.append((uuid, item))
                }
            }
            return results
        }

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

        do {
            let items = try await healthKitService.fetchRunningWorkoutsPage(limit: pageSize, beforeEndDate: cursor)
            if items.isEmpty {
                canLoadMore = false
                return
            }
            setRuns(Self.merged(existing: runs, incoming: items))
            removeLinkedRunsDuplicatedByMainList()
            canLoadMore = items.count == pageSize
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

    private func hydrateFromCacheIfNeeded() {
        guard !hasKnownRuns, let snapshot = cache.load() else { return }
        linkedRunsById = snapshot.linkedRunsById
        cacheUpdatedAt = snapshot.updatedAt
        canLoadMore = snapshot.runs.count >= pageSize
        setRuns(snapshot.runs)
    }

    private func setRuns(_ items: [HealthKitRunItem]) {
        state = .loaded(Self.sorted(items))
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
    private func scheduleDiagnostics(for items: [HealthKitRunItem]) {
        let service = healthKitService
        Task {
            let df = ISO8601DateFormatter()
            Self.diagLogger.debug("[HealthKitRunsView] fetchRunningWorkoutsPage(limit:\(self.pageSize), before:nil) retornou \(items.count) corrida(s)")
            for item in items {
                Self.diagLogger.debug("  [item] id=\(item.id) start=\(df.string(from: item.startDate)) distM=\(String(format: "%.0f", item.distanceMeters))")
            }

            let windowEnd = Date()
            let windowStart = windowEnd.addingTimeInterval(-14 * 24 * 3600)
            await service.diagnose(windowStart: windowStart, windowEnd: windowEnd, contextLabel: "HealthKitRunsView")
        }
    }

    func runZeppDiagnostic() async {
        guard !isRunningZeppDiagnostic else { return }
        guard healthKitService.isHealthDataAvailable else {
            zeppDiagnosticMessage = "HealthKit indisponivel neste dispositivo."
            return
        }

        isRunningZeppDiagnostic = true
        zeppDiagnosticMessage = "Rodando diagnostico Zepp..."
        defer { isRunningZeppDiagnostic = false }

        do {
            try await healthKitService.requestReadAuthorization()
            await healthKitService.diagnoseZeppWorkouts(limit: 10)
            zeppDiagnosticMessage = "Diagnostico Zepp enviado para os logs do Xcode."
        } catch {
            zeppDiagnosticMessage = "Falha no diagnostico Zepp: \(error.localizedDescription)"
        }
    }
    #else
    private func scheduleDiagnostics(for items: [HealthKitRunItem]) {}
    #endif
}
