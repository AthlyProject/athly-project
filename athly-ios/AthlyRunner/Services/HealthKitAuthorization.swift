import HealthKit

/// Snapshot dos tipos que o Athly pode gravar no HealthKit.
/// `authorizationStatus(for:)` representa somente escrita/compartilhamento.
struct HealthKitWriteAuthorizationSnapshot: Equatable, Sendable {
    let workout: HKAuthorizationStatus
    let route: HKAuthorizationStatus
    let distance: HKAuthorizationStatus
    let energy: HKAuthorizationStatus
    let heartRate: HKAuthorizationStatus

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
