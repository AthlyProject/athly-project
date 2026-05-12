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

    private let healthKitService: any HealthKitRunningWorkoutsProviding
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")

    init(healthKitService: any HealthKitRunningWorkoutsProviding = HealthKitService()) {
        self.healthKitService = healthKitService
    }

    var runs: [HealthKitRunItem] {
        if case .loaded(let items) = state { return items }
        return []
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
}
