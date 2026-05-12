import Foundation
import HealthKit
import CoreLocation
import os

// MARK: - Protocol (permite trocar por mock no simulador)

/// Fonte de dados de corridas: Health real ou mock (simulador).
/// Sendable para uso seguro em ViewModel @MainActor com async/await.
protocol HealthKitRunningWorkoutsProviding: AnyObject, Sendable {
    var isHealthDataAvailable: Bool { get }
    func requestReadAuthorization() async throws
    func requestWriteAuthorization() async throws
    func fetchLatestRunningWorkouts(limit: Int) async throws -> [HealthKitRunItem]
    func diagnose(windowStart: Date, windowEnd: Date, contextLabel: String) async
}

/// Serviço para leitura e escrita de corridas no Health Store.
/// @unchecked Sendable: HKHealthStore não é Sendable; uso é isolado a chamadas async do próprio tipo.
final class HealthKitService: HealthKitRunningWorkoutsProviding, @unchecked Sendable {

    private let store = HKHealthStore()

    private static let energyType = HKQuantityType(.activeEnergyBurned)
    private static let distanceType = HKQuantityType(.distanceWalkingRunning)
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")

    /// Verifica se o HealthKit está disponível (não disponível no simulador em muitos casos).
    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    /// Solicita apenas permissão de leitura para listar corridas existentes + HR para análise detalhada.
    /// No-op após a primeira solicitação por instalação (guard via PermissionGate).
    func requestReadAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        guard PermissionGate.shouldRequestHealthKitRead else { return }
        var typesToRead: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute(),
        ]
        if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) {
            typesToRead.insert(hrType)
        }
        try await store.requestAuthorization(toShare: [], read: typesToRead)
        PermissionGate.markHealthKitReadRequested()
    }

    /// Solicita permissão de escrita para salvar corridas no Apple Health.
    /// No-op após a primeira solicitação por instalação (guard via PermissionGate).
    func requestWriteAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        guard PermissionGate.shouldRequestHealthKitWrite else { return }
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            HealthKitService.energyType,
            HealthKitService.distanceType
        ]
        try await store.requestAuthorization(toShare: typesToShare, read: [])
        PermissionGate.markHealthKitWriteRequested()
    }

    /// Salva uma corrida no Apple Health e retorna o HKWorkout gerado (ou nil se finishWorkout falhar em produzi-lo).
    @discardableResult
    func saveWorkout(result: RunResult) async throws -> HKWorkout? {
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

        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<HKWorkout?, Error>) in
            builder.finishWorkout { workout, error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume(returning: workout)
                }
            }
        }
    }

    /// Busca as últimas corridas (e opcionalmente caminhadas) do Health Store.
    func fetchLatestRunningWorkouts(limit: Int = 20) async throws -> [HealthKitRunItem] {
        let workouts = try await fetchLatestRawRunningWorkouts(limit: limit)
        return workouts.map { self.map($0) }
    }

    /// Busca os últimos `HKWorkout` brutos (sem mapeamento). Usado pelo `WorkoutDetailFetcher`
    /// para extrair segmentos e HR por sessão.
    func fetchLatestRawRunningWorkouts(limit: Int) async throws -> [HKWorkout] {
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
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }
    }

    /// Diagnóstico: executa query estrita (somente .running) e query ampla (todos os workout types)
    /// na janela fornecida, logando resultado detalhado para identificar por que um workout do Nike
    /// Run Club (ou de outro app) pode estar ausente da listagem normal.
    func diagnose(windowStart: Date, windowEnd: Date, contextLabel: String) async {
        guard isHealthDataAvailable else {
            Self.diagLogger.debug("[\(contextLabel)] HealthKit não disponível — diagnóstico ignorado.")
            return
        }

        let authStatus = store.authorizationStatus(for: HKObjectType.workoutType())
        Self.diagLogger.debug("[\(contextLabel)] authorizationStatus(workoutType) = \(authStatus.rawValue) (0=notDetermined 1=sharingDenied 2=sharingAuthorized)")

        let df = ISO8601DateFormatter()
        Self.diagLogger.debug("[\(contextLabel)] janela: \(df.string(from: windowStart)) → \(df.string(from: windowEnd))")

        let workoutType = HKObjectType.workoutType()
        let datePredicate = HKQuery.predicateForSamples(withStart: windowStart, end: windowEnd, options: .strictStartDate)
        let runningPredicate = HKQuery.predicateForWorkouts(with: .running)
        let strictPredicate = NSCompoundPredicate(andPredicateWithSubpredicates: [runningPredicate, datePredicate])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        // Query estrita (espelha o comportamento atual do app)
        let strictWorkouts: [HKWorkout] = await withCheckedContinuation { continuation in
            let q = HKSampleQuery(sampleType: workoutType, predicate: strictPredicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, _ in
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(q)
        }
        Self.diagLogger.debug("[\(contextLabel)] QUERY ESTRITA (.running na janela): \(strictWorkouts.count) resultado(s)")
        for w in strictWorkouts {
            let distM = w.totalDistance?.doubleValue(for: .meter()) ?? 0
            let bundle = w.sourceRevision.source.bundleIdentifier
            let appName = w.sourceRevision.source.name
            let brand = w.metadata?["HKWorkoutBrandName"] as? String ?? "-"
            Self.diagLogger.debug("  [estrita] uuid=\(w.uuid.uuidString) type=\(w.workoutActivityType.rawValue) app=\(appName) bundle=\(bundle) brand=\(brand) start=\(df.string(from: w.startDate)) distM=\(String(format: "%.0f", distM))")
        }

        // Query ampla (todos os workout types na janela — captura workouts com tipo diferente de .running)
        let broadWorkouts: [HKWorkout] = await withCheckedContinuation { continuation in
            let q = HKSampleQuery(sampleType: workoutType, predicate: datePredicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, _ in
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(q)
        }
        Self.diagLogger.debug("[\(contextLabel)] QUERY AMPLA (todos os tipos na janela): \(broadWorkouts.count) resultado(s)")
        for w in broadWorkouts {
            let distM = w.totalDistance?.doubleValue(for: .meter()) ?? 0
            let bundle = w.sourceRevision.source.bundleIdentifier
            let appName = w.sourceRevision.source.name
            let brand = w.metadata?["HKWorkoutBrandName"] as? String ?? "-"
            let inStrict = strictWorkouts.contains(where: { $0.uuid == w.uuid })
            Self.diagLogger.debug("  [ampla\(inStrict ? "" : " ⚠️AUSENTE_DA_ESTRITA")] uuid=\(w.uuid.uuidString) type=\(w.workoutActivityType.rawValue) app=\(appName) bundle=\(bundle) brand=\(brand) start=\(df.string(from: w.startDate)) distM=\(String(format: "%.0f", distM))")
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
