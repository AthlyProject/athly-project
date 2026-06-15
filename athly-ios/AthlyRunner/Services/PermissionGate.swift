import Foundation

enum PermissionGate {
    // Versioned keys — bump version when the requested type set changes
    private static let healthKitReadKey = "permission.healthkit.read.requested.v1"
    // v2: passou a incluir a permissão de escrita de rota (HKSeriesType.workoutRoute) → re-solicita.
    private static let healthKitWriteKey = "permission.healthkit.write.requested.v2"

    static var shouldRequestHealthKitRead: Bool {
        !UserDefaults.standard.bool(forKey: healthKitReadKey)
    }

    static func markHealthKitReadRequested() {
        UserDefaults.standard.set(true, forKey: healthKitReadKey)
    }

    static var shouldRequestHealthKitWrite: Bool {
        !UserDefaults.standard.bool(forKey: healthKitWriteKey)
    }

    static func markHealthKitWriteRequested() {
        UserDefaults.standard.set(true, forKey: healthKitWriteKey)
    }
}
