import Foundation
import HealthKit
import UIKit
import OSLog

struct PlannerHealthContextPayload: Encodable, Sendable {
    let runs: [HealthRunPayload]
    let detailedSessions: [DetailedSessionPayload]?
    let timeZone: String
    let capturedAt: String
}

/// Shares the existing planner input builder between foreground generation and HealthKit delivery.
@MainActor
final class PlannerHealthSyncService {
    static let shared = PlannerHealthSyncService()
    private let store = HKHealthStore()
    private var observer: HKObserverQuery?
    private var uploadTask: Task<Void, Never>?
    private var needsAnotherSync = false
    private var sessionVersion = 0
    private let logger = Logger(subsystem: "com.athly.runner", category: "PlannerHealthSync")

    private init() {}

    func startObserving() {
        #if !targetEnvironment(simulator)
        guard HKHealthStore.isHealthDataAvailable() else { return }
        if observer == nil {
            let query = HKObserverQuery(sampleType: .workoutType(), predicate: nil) { _, completion, error in
                guard error == nil else { completion(); return }
                let delivery = HealthKitObserverCompletion(completion)
                Task { @MainActor in
                    await PlannerHealthSyncService.shared.sync()
                    delivery.finish()
                }
            }
            observer = query
            store.execute(query)
        }
        // Retry after authorization if the first launch preceded the HealthKit permission prompt.
        store.enableBackgroundDelivery(for: .workoutType(), frequency: .immediate) { _, _ in }
        #endif
    }

    func cancel() {
        sessionVersion += 1
        uploadTask?.cancel()
        uploadTask = nil
        needsAnotherSync = false
    }

    func sync() async {
        guard await APIClient.shared.isAuthenticated else { return }
        if let uploadTask {
            needsAnotherSync = true
            await uploadTask.value
            return
        }
        let version = sessionVersion
        let task = Task { [weak self] in
            guard let self else { return }
            repeat {
                self.needsAnotherSync = false
                do {
                    let context = try await self.capture()
                    try Task.checkCancellation()
                    guard self.sessionVersion == version else { return }
                    try await APIClient.shared.syncPlannerHealthContext(context)
                } catch {
                    // Do not upload an empty replacement when protected Health data/network is unavailable.
                    self.logger.info("Planner health sync deferred; will retry on the next delivery or foreground activation.")
                }
            } while self.needsAnotherSync && !Task.isCancelled && self.sessionVersion == version
        }
        uploadTask = task
        await task.value
        if sessionVersion == version { uploadTask = nil }
    }

    func capture() async throws -> PlannerHealthContextPayload {
        guard UIApplication.shared.isProtectedDataAvailable else { throw HealthKitError.notAvailable }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let capturedAt = formatter.string(from: Date())
        let request = try await buildInput(detailedLimit: 7, requestAuthorization: false, requireCompleteRead: true)
        return PlannerHealthContextPayload(runs: request.runs, detailedSessions: request.detailedSessions,
                                          timeZone: TimeZone.current.identifier, capturedAt: capturedAt)
    }

    func buildInput(detailedLimit: Int, requestAuthorization: Bool,
                    suppliedRuns: [HealthKitRunItem]? = nil, requireCompleteRead: Bool = false) async throws -> PlanFromHealthRequest {
        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()
        var runs = suppliedRuns ?? []
        if suppliedRuns == nil {
            guard service.isHealthDataAvailable else { throw HealthKitError.notAvailable }
            if requestAuthorization {
                try await service.requestReadAuthorization()
                startObserving()
            }
            runs = try await service.fetchLatestRunningWorkouts(limit: 20)
        }
        var details: [DetailedSessionPayload] = []
        if !runs.isEmpty {
            do { details = try await detailedSessions(limit: detailedLimit) }
            catch { if requireCompleteRead { throw error } }
        }
        return PlanFromHealthRequest(runs: runs.map { HealthRunPayload(from: $0) },
                                     detailedSessions: details.isEmpty ? nil : details, weekStartDate: nil)
    }

    private func detailedSessions(limit: Int) async throws -> [DetailedSessionPayload] {
        #if targetEnvironment(simulator)
        return []
        #else
        let service = HealthKitService()
        let workouts = try await service.fetchLatestRawRunningWorkouts(limit: limit)
        let fetcher = WorkoutDetailFetcher()
        var results: [DetailedSessionPayload] = []
        for workout in workouts {
            try Task.checkCancellation()
            let workoutId = RunWorkoutLinkStore.shared.athlyWorkoutId(for: workout.uuid.uuidString)
            if let payload = try await fetcher.buildDetailedSession(for: workout, athlyWorkoutId: workoutId) {
                results.append(payload)
            }
        }
        return results
        #endif
    }
}

/// HealthKit's completion block predates Sendable. Transfer it once, and serialize consumption.
private final class HealthKitObserverCompletion: @unchecked Sendable {
    private let lock = NSLock()
    private var completion: (() -> Void)?

    init(_ completion: @escaping () -> Void) {
        self.completion = completion
    }

    func finish() {
        lock.lock()
        let action = completion
        completion = nil
        lock.unlock()
        action?()
    }
}
