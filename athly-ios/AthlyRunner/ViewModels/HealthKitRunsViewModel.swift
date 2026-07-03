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
    #if DEBUG
    @Published private(set) var isRunningZeppDiagnostic = false
    @Published private(set) var zeppDiagnosticMessage: String?
    #endif

    private let healthKitService: any HealthKitRunningWorkoutsProviding
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")

    init(healthKitService: any HealthKitRunningWorkoutsProviding = HealthKitService()) {
        self.healthKitService = healthKitService
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
        return byId.values.sorted { $0.startDate > $1.startDate }
    }

    var isLoading: Bool {
        if case .loading = state { return true }
        return false
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
        if case .loaded(let items) = state { return items.isEmpty }
        return false
    }

    func loadWorkouts() async {
        guard healthKitService.isHealthDataAvailable else {
            state = .healthUnavailable
            return
        }

        state = .loading

        do {
            try await healthKitService.requestReadAuthorization()
            let items = try await healthKitService.fetchLatestRunningWorkouts(limit: 20)
            linkedRunsById = linkedRunsById.filter { cached in
                !items.contains { $0.id == cached.key }
            }

            let df = ISO8601DateFormatter()
            Self.diagLogger.debug("[HealthKitRunsView] fetchLatestRunningWorkouts(limit:20) retornou \(items.count) corrida(s)")
            for item in items {
                Self.diagLogger.debug("  [item] id=\(item.id) start=\(df.string(from: item.startDate)) distM=\(String(format: "%.0f", item.distanceMeters))")
            }

            let windowEnd = Date()
            let windowStart = windowEnd.addingTimeInterval(-14 * 24 * 3600)
            await healthKitService.diagnose(windowStart: windowStart, windowEnd: windowEnd, contextLabel: "HealthKitRunsView")

            state = .loaded(items)
        } catch let error as HealthKitError {
            switch error {
            case .notAvailable:
                state = .healthUnavailable
            }
        } catch {
            state = .error(error.localizedDescription)
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

        for uuid in missing {
            if let item = try? await healthKitService.fetchRunningWorkout(uuid: uuid) {
                linkedRunsById[uuid] = item
            }
        }
    }

    #if DEBUG
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
    #endif
}
