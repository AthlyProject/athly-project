import Foundation
import HealthKit
import CoreLocation

// MARK: - Protocol (permite trocar por mock no simulador)

/// Fonte de dados de corridas: Health real ou mock (simulador).
/// Sendable para uso seguro em ViewModel @MainActor com async/await.
protocol HealthKitRunningWorkoutsProviding: AnyObject, Sendable {
    var isHealthDataAvailable: Bool { get }
    func requestReadAuthorization() async throws
    func requestWriteAuthorization() async throws
    func fetchLatestRunningWorkouts(limit: Int) async throws -> [HealthKitRunItem]
}

/// Serviço para leitura e escrita de corridas no Health Store.
/// @unchecked Sendable: HKHealthStore não é Sendable; uso é isolado a chamadas async do próprio tipo.
final class HealthKitService: HealthKitRunningWorkoutsProviding, @unchecked Sendable {

    private let store = HKHealthStore()

    private static let energyType = HKQuantityType(.activeEnergyBurned)
    private static let distanceType = HKQuantityType(.distanceWalkingRunning)

    /// Verifica se o HealthKit está disponível (não disponível no simulador em muitos casos).
    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    /// Solicita apenas permissão de leitura para listar corridas existentes.
    func requestReadAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        let typesToRead: Set<HKObjectType> = [HKObjectType.workoutType()]
        try await store.requestAuthorization(toShare: [], read: typesToRead)
    }

    /// Solicita permissão de escrita para salvar corridas no Apple Health.
    func requestWriteAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HealthKitService.energyType,
            HealthKitService.distanceType
        ]
        try await store.requestAuthorization(toShare: typesToShare, read: [])
    }

    /// Salva uma corrida no Apple Health.
    func saveWorkout(result: RunResult) async throws {
        guard isHealthDataAvailable else { throw HealthKitError.notAvailable }

        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            builder.beginCollection(withStart: result.startDate) { _, error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }

        var samples: [HKSample] = []

        if result.caloriesBurned > 0 {
            samples.append(HKQuantitySample(
                type: HealthKitService.energyType,
                quantity: HKQuantity(unit: .kilocalorie(), doubleValue: result.caloriesBurned),
                start: result.startDate,
                end: result.endDate
            ))
        }

        if result.distanceMeters > 0 {
            samples.append(HKQuantitySample(
                type: HealthKitService.distanceType,
                quantity: HKQuantity(unit: .meter(), doubleValue: result.distanceMeters),
                start: result.startDate,
                end: result.endDate
            ))
        }

        if !samples.isEmpty {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                builder.add(samples) { _, error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
        }

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            builder.addMetadata([
                "activeDurationSeconds": result.durationSeconds,
                "averagePaceSecondsPerKm": result.averagePaceSecondsPerKm
            ]) { _, error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            builder.endCollection(withEnd: result.endDate) { _, error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            builder.finishWorkout { _, error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
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
        let distanceMeters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
        let activeDuration = workout.metadata?["activeDurationSeconds"] as? Double ?? workout.duration
        let averagePaceSecondsPerKm: Double = {
            if let stored = workout.metadata?["averagePaceSecondsPerKm"] as? Double, stored > 0 {
                return stored
            }
            guard distanceMeters > 0 else { return 0 }
            return activeDuration / (distanceMeters / 1000.0)
        }()
        let durationSeconds = activeDuration
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
