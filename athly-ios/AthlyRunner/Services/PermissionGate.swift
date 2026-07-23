import Foundation

enum PermissionGate {
    // Versioned write key — bump when the requested share type set changes.
    // Read authorization is requested directly because HealthKit does not expose per-type
    // read status and repeated calls are safe.
    // v4: workout, rota, distância e energia passam a ser pedidos juntos. O HealthKit exige
    // workout no mesmo pedido da rota; um único sheet também evita decisões conflitantes.
    private static let healthKitWriteKey = "permission.healthkit.write.requested.v4"

    static var shouldRequestHealthKitWrite: Bool {
        !UserDefaults.standard.bool(forKey: healthKitWriteKey)
    }

    static func markHealthKitWriteRequested() {
        UserDefaults.standard.set(true, forKey: healthKitWriteKey)
    }
}
