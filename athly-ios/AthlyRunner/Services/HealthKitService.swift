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

    // Metadata dos HKWorkoutEvents(.segment) gravados pelo app — lidos de volta pelo
    // WorkoutDetailFetcher para reconstruir a estrutura executada com valores reais.
    static let segmentKindMetadataKey = "athlySegmentKind"
    static let segmentIndexMetadataKey = "athlySegmentIndex"
    static let segmentDistanceMetadataKey = "athlyDistanceMeters"
    static let segmentDurationMetadataKey = "athlyDurationSeconds"

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
            HealthKitService.distanceType,
            HKSeriesType.workoutRoute()
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

        // Fronteiras reais dos segmentos executados (treino estruturado). Sem esses
        // eventos a estrutura do treino se perde na releitura e a análise da IA vê a
        // corrida como km splits genéricos ("nenhum tiro detectado"). Best-effort.
        let segmentEvents: [HKWorkoutEvent] = result.segmentRecords.compactMap { record in
            guard record.endDate > record.startDate else { return nil }
            var metadata: [String: Any] = [
                Self.segmentKindMetadataKey: record.kind.rawValue,
                Self.segmentDistanceMetadataKey: record.distanceMeters,
                Self.segmentDurationMetadataKey: record.durationSeconds
            ]
            if let setIndex = record.setIndex {
                metadata[Self.segmentIndexMetadataKey] = setIndex
            }
            return HKWorkoutEvent(
                type: .segment,
                dateInterval: DateInterval(start: record.startDate, end: record.endDate),
                metadata: metadata
            )
        }

        // Pausas explícitas como eventos .pause/.resume — permitem reconstruir, na releitura do
        // Health, os mesmos splits do app (descontando a pausa) mesmo quando o match local falha.
        let pauseEvents: [HKWorkoutEvent] = result.pauseIntervals.flatMap { interval -> [HKWorkoutEvent] in
            guard interval.end > interval.start else { return [] }
            return [
                HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: interval.start, end: interval.start), metadata: nil),
                HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: interval.end, end: interval.end), metadata: nil)
            ]
        }

        let workoutEvents = segmentEvents + pauseEvents
        if !workoutEvents.isEmpty {
            try? await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                builder.addWorkoutEvents(workoutEvents) { _, error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
        }

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            builder.endCollection(withEnd: result.endDate) { _, error in
                if let error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }

        let workout = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<HKWorkout?, Error>) in
            builder.finishWorkout { workout, error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume(returning: workout)
                }
            }
        }

        // Anexa a rota GPS (best-effort) para o Histórico mostrar mapa + splits.
        if let workout, !result.locations.isEmpty {
            await saveRoute(result.locations, to: workout)
        }

        return workout
    }

    /// Anexa a rota GPS (CLLocations) ao HKWorkout já salvo. Best-effort: falha não invalida a corrida.
    private func saveRoute(_ locations: [CLLocation], to workout: HKWorkout) async {
        let routeBuilder = HKWorkoutRouteBuilder(healthStore: store, device: .local())
        do {
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                routeBuilder.insertRouteData(locations) { _, error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
            try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
                routeBuilder.finishRoute(with: workout, metadata: nil) { _, error in
                    if let error { cont.resume(throwing: error) } else { cont.resume() }
                }
            }
        } catch {
            // Ignora: a corrida já está salva; só a rota não foi anexada.
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

    // MARK: - Pausas

    /// Extrai as janelas de pausa explícita de um HKWorkout, para o cálculo offline de splits
    /// descontar a pausa igual ao caminho ao vivo (sem isso o gap da pausa virava distância
    /// fantasma + tempo parado contado como movimento). Primeiro tenta os eventos .pause/.resume
    /// (também aceita o auto-pause .motionPaused/.motionResumed do Apple Watch); se não houver,
    /// cai para os gaps entre HKWorkoutActivity (treinos estruturados, iOS 17+). Vazio → sem pausa.
    static func pauseIntervals(from workout: HKWorkout) -> [SplitCalculator.PauseInterval] {
        let pauseTypes: Set<HKWorkoutEventType> = [.pause, .motionPaused]
        let resumeTypes: Set<HKWorkoutEventType> = [.resume, .motionResumed]
        let events = (workout.workoutEvents ?? [])
            .filter { pauseTypes.contains($0.type) || resumeTypes.contains($0.type) }
            .sorted { $0.dateInterval.start < $1.dateInterval.start }

        var intervals: [SplitCalculator.PauseInterval] = []
        var openPause: Date?
        for event in events {
            if pauseTypes.contains(event.type) {
                if openPause == nil { openPause = event.dateInterval.start }
            } else if resumeTypes.contains(event.type), let start = openPause {
                let end = event.dateInterval.start
                if end > start { intervals.append(.init(start: start, end: end)) }
                openPause = nil
            }
        }
        // Pausa sem resume → estende até o fim do treino.
        if let start = openPause, workout.endDate > start {
            intervals.append(.init(start: start, end: workout.endDate))
        }
        if !intervals.isEmpty { return intervals }

        // Fallback: gaps entre as atividades estruturadas (a soma das atividades é o tempo ativo;
        // os buracos entre elas são pausas).
        if #available(iOS 17.0, *) {
            let acts = workout.workoutActivities.sorted { $0.startDate < $1.startDate }
            guard acts.count >= 2 else { return [] }
            var gaps: [SplitCalculator.PauseInterval] = []
            for i in 1..<acts.count {
                let prevEnd = acts[i - 1].endDate ?? acts[i - 1].startDate
                let nextStart = acts[i].startDate
                if nextStart > prevEnd { gaps.append(.init(start: prevEnd, end: nextStart)) }
            }
            return gaps
        }
        return []
    }

    // MARK: - Detalhe de uma corrida (rota + splits + FC) para o histórico

    /// Monta o detalhe de uma corrida (rota, splits por km e FC) a partir do UUID do HKWorkout.
    /// Retorna nil se a corrida não for encontrada ou o HealthKit estiver indisponível. Sem rota
    /// (ex.: Garmin/Nike/esteira) → `coordinates`/`splits` vazios e a tela mostra só os stats.
    func fetchRunDetail(workoutUUID: String) async -> RunRouteDetail? {
        guard isHealthDataAvailable,
              let uuid = UUID(uuidString: workoutUUID),
              let workout = await fetchWorkout(uuid: uuid) else { return nil }

        let locations = await fetchRouteLocations(for: workout)
        let splits = locations.count >= 2
            ? SplitCalculator.kmSplits(from: locations, pauses: Self.pauseIntervals(from: workout))
            : []
        let coordinates = locations.map {
            RunCoordinate(latitude: $0.coordinate.latitude, longitude: $0.coordinate.longitude)
        }
        let hr = await fetchHRStats(for: workout)

        return RunRouteDetail(coordinates: coordinates, splits: splits, avgHR: hr?.avg, maxHR: hr?.max)
    }

    private func fetchWorkout(uuid: UUID) async -> HKWorkout? {
        let predicate = HKQuery.predicateForObject(with: uuid)
        return await withCheckedContinuation { (cont: CheckedContinuation<HKWorkout?, Never>) in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: predicate,
                limit: 1,
                sortDescriptors: nil
            ) { _, samples, _ in
                cont.resume(returning: (samples as? [HKWorkout])?.first)
            }
            store.execute(query)
        }
    }

    private func fetchRouteLocations(for workout: HKWorkout) async -> [CLLocation] {
        let routes: [HKWorkoutRoute] = await withCheckedContinuation { (cont: CheckedContinuation<[HKWorkoutRoute], Never>) in
            let predicate = HKQuery.predicateForObjects(from: workout)
            let query = HKAnchoredObjectQuery(
                type: HKSeriesType.workoutRoute(),
                predicate: predicate,
                anchor: nil,
                limit: HKObjectQueryNoLimit
            ) { _, samples, _, _, _ in
                cont.resume(returning: (samples as? [HKWorkoutRoute]) ?? [])
            }
            store.execute(query)
        }
        guard !routes.isEmpty else { return [] }

        var all: [CLLocation] = []
        for route in routes {
            all.append(contentsOf: await fetchLocations(for: route))
        }
        all.sort { $0.timestamp < $1.timestamp }
        return all
    }

    private func fetchLocations(for route: HKWorkoutRoute) async -> [CLLocation] {
        let buffer = LocationsBuffer()
        return await withCheckedContinuation { (cont: CheckedContinuation<[CLLocation], Never>) in
            let query = HKWorkoutRouteQuery(route: route) { _, locations, done, _ in
                if let locations { buffer.append(locations) }
                if done { cont.resume(returning: buffer.snapshot()) }
            }
            store.execute(query)
        }
    }

    private func fetchHRStats(for workout: HKWorkout) async -> (avg: Double, max: Double)? {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return nil }
        let predicate = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate, options: .strictStartDate)
        let unit = HKUnit.count().unitDivided(by: .minute())
        return await withCheckedContinuation { (cont: CheckedContinuation<(avg: Double, max: Double)?, Never>) in
            let query = HKStatisticsQuery(
                quantityType: hrType,
                quantitySamplePredicate: predicate,
                options: [.discreteAverage, .discreteMax]
            ) { _, stats, _ in
                let avg = stats?.averageQuantity()?.doubleValue(for: unit) ?? 0
                let mx = stats?.maximumQuantity()?.doubleValue(for: unit) ?? 0
                cont.resume(returning: avg > 0 ? (avg, mx) : nil)
            }
            store.execute(query)
        }
    }
}

/// Buffer thread-safe para acumular os locations entregues em lotes pelo `HKWorkoutRouteQuery`.
private final class LocationsBuffer: @unchecked Sendable {
    private var items: [CLLocation] = []
    private let lock = NSLock()
    func append(_ new: [CLLocation]) { lock.lock(); items.append(contentsOf: new); lock.unlock() }
    func snapshot() -> [CLLocation] { lock.lock(); defer { lock.unlock() }; return items }
}

/// Detalhe de uma corrida para a tela de summary do histórico. Sendable para cruzar para o @MainActor.
struct RunRouteDetail: Sendable {
    let coordinates: [RunCoordinate]
    let splits: [KmSplit]
    let avgHR: Double?
    let maxHR: Double?
    var hasRoute: Bool { coordinates.count >= 2 }
}

struct RunCoordinate: Sendable {
    let latitude: Double
    let longitude: Double
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
