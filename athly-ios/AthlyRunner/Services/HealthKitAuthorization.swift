import HealthKit
import UIKit
import os

/// The cache identifies the request we prepared, never the permissions the user granted.
struct HealthKitAuthorizationRequest: Equatable, Sendable {
    let read: Set<HKObjectType>
    let share: Set<HKSampleType>

    static let current = HealthKitAuthorizationRequest(
        read: [HKObjectType.workoutType(), HKSeriesType.workoutRoute(),
               HKQuantityType(.heartRate), HKQuantityType(.restingHeartRate)],
        share: [HKObjectType.workoutType(), HKSeriesType.workoutRoute(),
                HKQuantityType(.distanceWalkingRunning), HKQuantityType(.activeEnergyBurned),
                HKQuantityType(.heartRate)]
    )
}

protocol HealthKitAuthorizationClient: Sendable {
    func requestStatus(for request: HealthKitAuthorizationRequest) async throws -> HKAuthorizationRequestStatus
    func requestAuthorization(for request: HealthKitAuthorizationRequest) async throws
    func writeSnapshot() async -> HealthKitWriteAuthorizationSnapshot
}

private final class SystemHealthKitAuthorizationClient: HealthKitAuthorizationClient, @unchecked Sendable {
    private let store = HKHealthStore()

    func requestStatus(for request: HealthKitAuthorizationRequest) async throws -> HKAuthorizationRequestStatus {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthKitError.notAvailable }
        return try await withCheckedThrowingContinuation { continuation in
            store.getRequestStatusForAuthorization(toShare: request.share, read: request.read) { status, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: status) }
            }
        }
    }

    func requestAuthorization(for request: HealthKitAuthorizationRequest) async throws {
        try await store.requestAuthorization(toShare: request.share, read: request.read)
    }

    func writeSnapshot() async -> HealthKitWriteAuthorizationSnapshot {
        HealthKitWriteAuthorizationSnapshot(store: store)
    }
}

enum HealthKitAuthorizationPreparationError: LocalizedError {
    case unknownStatus
    case requiresForeground

    var errorDescription: String? {
        switch self {
        case .unknownStatus:
            return String(localized: "Não foi possível verificar as permissões do Apple Health. Tente novamente.")
        case .requiresForeground:
            return String(localized: "Abra o Athly para configurar as permissões do Apple Health.")
        }
    }
}

/// Serializes authorization across all services. HealthKit remains the source of truth.
actor HealthKitAuthorizationCoordinator {
    static let shared = HealthKitAuthorizationCoordinator(client: SystemHealthKitAuthorizationClient())
    private static let logger = Logger(subsystem: "com.athly.healthkit.diag", category: "Authorization")

    private struct Preparation {
        let id = UUID()
        let request: HealthKitAuthorizationRequest
        let generation: Int
        let task: Task<Void, Error>
    }

    private let client: any HealthKitAuthorizationClient
    private let canPresent: @Sendable () async -> Bool
    private var prepared: HealthKitAuthorizationRequest?
    private var pending: Preparation?
    private var generation = 0

    init(client: any HealthKitAuthorizationClient,
         canPresent: @escaping @Sendable () async -> Bool = {
             await MainActor.run { UIApplication.shared.applicationState != .background }
         }) {
        self.client = client
        self.canPresent = canPresent
    }

    /// Called only after a real background transition, not after an authorization sheet.
    func invalidate() {
        generation += 1
        prepared = nil
        // Do not cancel or overlap an authorization request already on screen.
    }

    func prepare(for request: HealthKitAuthorizationRequest = .current) async throws {
        try Task.checkCancellation()
        if let pending {
            if pending.request == request {
                try await finish(pending)
                return
            }
            // Even different scopes must not present two sheets at once.
            _ = try? await pending.task.value
            if self.pending?.id == pending.id { self.pending = nil }
            try Task.checkCancellation()
            try await prepare(for: request)
            return
        }
        guard prepared != request else { return }

        let client = client
        let canPresent = canPresent
        let task = Task {
            let started = Date()
            do {
                let status = try await client.requestStatus(for: request)
                Self.logger.notice("[HealthAuthorization] requestStatus=\(status.rawValue, privacy: .public)")
                switch status {
                case .unnecessary:
                    break
                case .shouldRequest:
                    guard await canPresent() else { throw HealthKitAuthorizationPreparationError.requiresForeground }
                    try await client.requestAuthorization(for: request)
                case .unknown:
                    throw HealthKitAuthorizationPreparationError.unknownStatus
                @unknown default:
                    throw HealthKitAuthorizationPreparationError.unknownStatus
                }
                Self.logger.notice("[HealthAuthorization] prepared durationMs=\(Int(Date().timeIntervalSince(started) * 1000), privacy: .public)")
            } catch {
                let nsError = error as NSError
                Self.logger.error("[HealthAuthorization] failed domain=\(nsError.domain, privacy: .public) code=\(nsError.code, privacy: .public) durationMs=\(Int(Date().timeIntervalSince(started) * 1000), privacy: .public)")
                throw error
            }
        }
        let preparation = Preparation(request: request, generation: generation, task: task)
        pending = preparation
        try await finish(preparation)
    }

    private func finish(_ preparation: Preparation) async throws {
        defer { if pending?.id == preparation.id { pending = nil } }
        try await preparation.task.value
        try Task.checkCancellation()
        if pending?.id == preparation.id, generation == preparation.generation {
            prepared = preparation.request
        }
    }

    func prepareForWriting() async throws -> HealthKitWriteAuthorizationSnapshot {
        try await prepare()
        let snapshot = await client.writeSnapshot()
        try Task.checkCancellation()
        guard snapshot.canWriteWorkout else { throw HealthKitError.writeDenied }
        return snapshot
    }
}

/// Snapshot dos tipos que o Athly pode gravar no HealthKit.
/// `authorizationStatus(for:)` representa somente escrita/compartilhamento.
struct HealthKitWriteAuthorizationSnapshot: Equatable, Sendable {
    let workout: HKAuthorizationStatus
    let route: HKAuthorizationStatus
    let distance: HKAuthorizationStatus
    let energy: HKAuthorizationStatus
    let heartRate: HKAuthorizationStatus

    init(store: HKHealthStore) {
        self.init(workout: store.authorizationStatus(for: HKObjectType.workoutType()),
                  route: store.authorizationStatus(for: HKSeriesType.workoutRoute()),
                  distance: store.authorizationStatus(for: HKQuantityType(.distanceWalkingRunning)),
                  energy: store.authorizationStatus(for: HKQuantityType(.activeEnergyBurned)),
                  heartRate: store.authorizationStatus(for: HKQuantityType(.heartRate)))
    }

    init(
        workout: HKAuthorizationStatus,
        route: HKAuthorizationStatus,
        distance: HKAuthorizationStatus,
        energy: HKAuthorizationStatus,
        heartRate: HKAuthorizationStatus = .notDetermined
    ) {
        self.workout = workout
        self.route = route
        self.distance = distance
        self.energy = energy
        self.heartRate = heartRate
    }

    var canWriteWorkout: Bool {
        workout == .sharingAuthorized
    }

    var canWriteRoute: Bool {
        route == .sharingAuthorized
    }

    var canWriteDistance: Bool {
        distance == .sharingAuthorized
    }

    var canWriteEnergy: Bool {
        energy == .sharingAuthorized
    }

    var canWriteHeartRate: Bool {
        heartRate == .sharingAuthorized
    }

    static let fullyAuthorized = HealthKitWriteAuthorizationSnapshot(
        workout: .sharingAuthorized,
        route: .sharingAuthorized,
        distance: .sharingAuthorized,
        energy: .sharingAuthorized,
        heartRate: .sharingAuthorized
    )
}
