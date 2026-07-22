import Foundation

enum PermissionGate {
    // Versioned write key — bump when the requested share type set changes.
    // Read authorization is requested directly because HealthKit does not expose per-type
    // read status and repeated calls are safe.
    // v3: volta a pedir o conjunto essencial sem deixar rota bloquear o workout principal.
    private static let healthKitWriteKey = "permission.healthkit.write.requested.v3"
    private static let healthKitRouteWriteKey = "permission.healthkit.route.write.requested.v1"

    static var shouldRequestHealthKitWrite: Bool {
        !UserDefaults.standard.bool(forKey: healthKitWriteKey)
    }

    static var shouldRequestHealthKitRouteWrite: Bool {
        !UserDefaults.standard.bool(forKey: healthKitRouteWriteKey)
    }

    static func markHealthKitWriteRequested() {
        UserDefaults.standard.set(true, forKey: healthKitWriteKey)
    }

    static func markHealthKitRouteWriteRequested() {
        UserDefaults.standard.set(true, forKey: healthKitRouteWriteKey)
    }
}
