import Foundation

/// Dados mockados do "dono do iPhone" do simulador: corridas tipadas para testes sem Health real.
/// Usado automaticamente quando o app roda no simulador (HealthKit indisponível).
final class MockHealthKitService: HealthKitRunningWorkoutsProviding, Sendable {

    var isHealthDataAvailable: Bool { true }

    func requestAuthorization() async throws {
        // No mock não há autorização real.
    }

    func fetchLatestRunningWorkouts(limit: Int = 20) async throws -> [HealthKitRunItem] {
        try await Task.sleep(nanoseconds: 400_000_000) // 0,4 s para simular rede/IO
        return Self.simulatorOwnerRuns.prefix(limit).map { $0 }
    }

    // MARK: - Dados do “dono do iPhone” do simulador (tipados)

    private static let calendar = Calendar.current

    private static var simulatorOwnerRuns: [HealthKitRunItem] {
        let now = Date()
        return [
            run(
                id: "mock-run-1",
                daysAgo: 0,
                hour: 7,
                minute: 30,
                durationMinutes: 32,
                distanceKm: 5.12,
                calories: 312,
                elevation: 28
            ),
            run(
                id: "mock-run-2",
                daysAgo: 2,
                hour: 18,
                minute: 15,
                durationMinutes: 28,
                distanceKm: 4.02,
                calories: 245,
                elevation: 12
            ),
            run(
                id: "mock-run-3",
                daysAgo: 4,
                hour: 6,
                minute: 45,
                durationMinutes: 58,
                distanceKm: 10.00,
                calories: 598,
                elevation: 45
            ),
            run(
                id: "mock-run-4",
                daysAgo: 5,
                hour: 19,
                minute: 0,
                durationMinutes: 18,
                distanceKm: 3.01,
                calories: 178,
                elevation: nil
            ),
            run(
                id: "mock-run-5",
                daysAgo: 7,
                hour: 8,
                minute: 0,
                durationMinutes: 42,
                distanceKm: 6.50,
                calories: 398,
                elevation: 32
            ),
        ].map { buildItem(now: now, run: $0) }
    }

    private struct RunSpec {
        let id: String
        let daysAgo: Int
        let hour: Int
        let minute: Int
        let durationMinutes: Int
        let distanceKm: Double
        let calories: Double
        let elevation: Double?
    }

    private static func run(
        id: String,
        daysAgo: Int,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        distanceKm: Double,
        calories: Double,
        elevation: Double?
    ) -> RunSpec {
        RunSpec(
            id: id,
            daysAgo: daysAgo,
            hour: hour,
            minute: minute,
            durationMinutes: durationMinutes,
            distanceKm: distanceKm,
            calories: calories,
            elevation: elevation
        )
    }

    private static func buildItem(now: Date, run spec: RunSpec) -> HealthKitRunItem {
        guard let startDate = calendar.date(byAdding: .day, value: -spec.daysAgo, to: now).flatMap({
            calendar.date(bySettingHour: spec.hour, minute: spec.minute, second: 0, of: $0)
        }) else {
            fatalError("Mock dates inválidos")
        }
        let durationSeconds = Double(spec.durationMinutes * 60)
        let distanceMeters = spec.distanceKm * 1000
        let endDate = startDate.addingTimeInterval(durationSeconds)
        let averagePaceSecondsPerKm = distanceMeters > 0 ? (durationSeconds / (distanceMeters / 1000.0)) : 0

        return HealthKitRunItem(
            id: spec.id,
            startDate: startDate,
            endDate: endDate,
            durationSeconds: durationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            activeEnergyBurned: spec.calories,
            elevationGainMeters: spec.elevation
        )
    }
}
