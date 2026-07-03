import Foundation

enum PermissionGate {
    // Versioned write key — bump when the requested share type set changes.
    // Read authorization is requested directly because HealthKit does not expose per-type
    // read status and repeated calls are safe.
    // v2: passou a incluir a permissão de escrita de rota (HKSeriesType.workoutRoute) → re-solicita.
    private static let healthKitWriteKey = "permission.healthkit.write.requested.v2"

    static var shouldRequestHealthKitWrite: Bool {
        !UserDefaults.standard.bool(forKey: healthKitWriteKey)
    }

    static func markHealthKitWriteRequested() {
        UserDefaults.standard.set(true, forKey: healthKitWriteKey)
    }
}
