import Foundation
import HealthKit

// MARK: - Protocol (permite trocar por mock no simulador)

/// Fonte de dados de corridas: Health real ou mock (simulador).
/// Sendable para uso seguro em ViewModel @MainActor com async/await.
protocol HealthKitRunningWorkoutsProviding: AnyObject, Sendable {
    var isHealthDataAvailable: Bool { get }
    func requestAuthorization() async throws
    func fetchLatestRunningWorkouts(limit: Int) async throws -> [HealthKitRunItem]
}

/// Serviço para leitura de corridas do Health Store (somente leitura, testes de integração).
/// @unchecked Sendable: HKHealthStore não é Sendable; uso é isolado a chamadas async do próprio tipo.
final class HealthKitService: HealthKitRunningWorkoutsProviding, @unchecked Sendable {

    private let store = HKHealthStore()

    /// Verifica se o HealthKit está disponível (não disponível no simulador em muitos casos).
    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    /// Solicita autorização para leitura de workouts.
    func requestAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        let workoutType = HKObjectType.workoutType()
        try await store.requestAuthorization(toShare: [], read: [workoutType])
    }

    /// Busca as últimas corridas (e opcionalmente caminhadas) do Health Store.
    func fetchLatestRunningWorkouts(limit: Int = 20) async throws -> [HealthKitRunItem] {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }

        let workoutType = HKObjectType.workoutType()
        let predicate = HKQuery.predicateForWorkouts(with: .running)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: predicate,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let workouts = (samples as? [HKWorkout]) ?? []
                let items = workouts.map { self.map($0) }
                continuation.resume(returning: items)
            }
            store.execute(query)
        }
    }

    private func map(_ workout: HKWorkout) -> HealthKitRunItem {
        let durationSeconds = workout.duration
        let distanceMeters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
        let averagePaceSecondsPerKm: Double = {
            guard distanceMeters > 0 else { return 0 }
            return (durationSeconds / (distanceMeters / 1000.0))
        }()
        let activeEnergyBurned = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
        let elevationGainMeters: Double? = nil // HKWorkout não expõe elevação direta; seria via HKQuantityTypeIdentifier.flightsClimbed ou route

        return HealthKitRunItem(
            id: workout.uuid.uuidString,
            startDate: workout.startDate,
            endDate: workout.endDate,
            durationSeconds: durationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            activeEnergyBurned: activeEnergyBurned,
            elevationGainMeters: elevationGainMeters
        )
    }
}

enum HealthKitError: LocalizedError {
    case notAvailable

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "O Apple Health não está disponível neste dispositivo (por exemplo, no simulador)."
        }
    }
}
