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
    func diagnoseZeppWorkouts(limit: Int) async
}

/// Serviço para leitura e escrita de corridas no Health Store.
/// @unchecked Sendable: HKHealthStore não é Sendable; uso é isolado a chamadas async do próprio tipo.
final class HealthKitService: HealthKitRunningWorkoutsProviding, @unchecked Sendable {

    private let store = HKHealthStore()

    private static let energyType = HKQuantityType(.activeEnergyBurned)
    private static let distanceType = HKQuantityType(.distanceWalkingRunning)
    private static let diagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "WorkoutQuery")
    private static let zeppDiagLogger = Logger(subsystem: "com.athly.healthkit.diag", category: "ZeppWorkout")

    // Metadata dos HKWorkoutEvents(.segment) gravados pelo app — lidos de volta pelo
    // WorkoutDetailFetcher para reconstruir a estrutura executada com valores reais.
    static let segmentKindMetadataKey = "athlySegmentKind"
    static let segmentIndexMetadataKey = "athlySegmentIndex"
    static let segmentDistanceMetadataKey = "athlyDistanceMeters"
    static let segmentDurationMetadataKey = "athlyDurationSeconds"

    private struct HeartRateSummary {
        let linkedCount: Int
        let sameSourceCount: Int
        let windowCount: Int
        let avgBPM: Double?
        let maxBPM: Double?

        var availableCount: Int {
            linkedCount > 0 ? linkedCount : sameSourceCount
        }
    }

    /// Verifica se o HealthKit está disponível (não disponível no simulador em muitos casos).
    var isHealthDataAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    /// Solicita apenas permissão de leitura para listar corridas existentes + HR para análise detalhada.
    /// HealthKit não expõe status de permissão de leitura por tipo; chamar novamente é seguro e
    /// permite que novos tipos adicionados pelo app sejam solicitados quando necessário.
    func requestReadAuthorization() async throws {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        var typesToRead: Set<HKObjectType> = [
            HKObjectType.workoutType(),
            HKSeriesType.workoutRoute(),
        ]
        if let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) {
            typesToRead.insert(hrType)
        }
        try await store.requestAuthorization(toShare: [], read: typesToRead)
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
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let strictPredicate = HKQuery.predicateForWorkouts(with: .running)
        let strictWorkouts = try await queryWorkouts(
            sampleType: workoutType,
            predicate: strictPredicate,
            limit: limit,
            sortDescriptors: [sort]
        )

        // Alguns importadores de wearables gravam corrida como `.other`, mesmo aparecendo
        // como corrida no Fitness. Escaneamos uma janela maior e aceitamos só casos com
        // forte evidência de corrida para não misturar bike/caminhada na ingestão.
        let broadScanLimit = max(100, limit * 10)
        let broadWorkouts = try await queryWorkouts(
            sampleType: workoutType,
            predicate: nil,
            limit: broadScanLimit,
            sortDescriptors: [sort]
        )

        var uniqueByUUID: [UUID: HKWorkout] = [:]
        for workout in strictWorkouts + broadWorkouts where isRunningWorkoutCandidate(workout) {
            uniqueByUUID[workout.uuid] = workout
        }

        return Array(uniqueByUUID.values)
            .sorted { $0.endDate > $1.endDate }
            .prefix(limit)
            .map { $0 }
    }

    /// Busca um `HKWorkout` bruto específico pelo UUID escolhido pelo usuário no vínculo HealthKit.
    func fetchRawWorkout(uuid uuidString: String) async throws -> HKWorkout? {
        guard isHealthDataAvailable else {
            throw HealthKitError.notAvailable
        }
        guard let uuid = UUID(uuidString: uuidString) else {
            return nil
        }

        let workoutType = HKObjectType.workoutType()
        let predicate = HKQuery.predicateForObject(with: uuid)
        return try await queryWorkouts(
            sampleType: workoutType,
            predicate: predicate,
            limit: 1,
            sortDescriptors: nil
        ).first
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
            let device = deviceDescription(w)
            Self.diagLogger.debug("  [estrita] uuid=\(w.uuid.uuidString) type=\(w.workoutActivityType.rawValue) app=\(appName) bundle=\(bundle) brand=\(brand) device=\(device) start=\(df.string(from: w.startDate)) distM=\(String(format: "%.0f", distM))")
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
            let device = deviceDescription(w)
            let inStrict = strictWorkouts.contains(where: { $0.uuid == w.uuid })
            let accepted = isRunningWorkoutCandidate(w)
            Self.diagLogger.debug("  [ampla\(inStrict ? "" : " AUSENTE_DA_ESTRITA")\(accepted ? " ACEITA_COMO_CORRIDA" : "")] uuid=\(w.uuid.uuidString) type=\(w.workoutActivityType.rawValue) app=\(appName) bundle=\(bundle) brand=\(brand) device=\(device) start=\(df.string(from: w.startDate)) distM=\(String(format: "%.0f", distM))")
        }
    }

    /// Diagnóstico focado em treinos gravados no Apple Health por Zepp/Amazfit.
    /// Loga quais campos realmente chegaram ao HealthKit para validar se o fluxo
    /// `plan-from-health` pode usar agregados, rota, splits e FC como fontes ricas.
    func diagnoseZeppWorkouts(limit: Int = 10) async {
        guard isHealthDataAvailable else {
            Self.zeppDiagLogger.notice("[ZeppDiag] HealthKit indisponivel; diagnostico ignorado.")
            return
        }

        let requestedLimit = max(1, limit)
        let scanLimit = max(50, requestedLimit * 5)
        let workouts = await fetchLatestRawWorkouts(limit: scanLimit)
        let matches = Array(workouts.filter(isZeppOrAmazfitWorkout).prefix(requestedLimit))
        let df = ISO8601DateFormatter()

        Self.zeppDiagLogger.notice("[ZeppDiagStart] scanned=\(workouts.count, privacy: .public) matched=\(matches.count, privacy: .public) requestedLimit=\(requestedLimit, privacy: .public) scanLimit=\(scanLimit, privacy: .public)")

        var withDistance = 0
        var withRoute = 0
        var withHR = 0
        var withEvents = 0
        var withSplits = 0

        for workout in matches {
            let distanceM = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
            let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
            let routes = await fetchRoutes(for: workout)
            var locations: [CLLocation] = []
            for route in routes {
                locations.append(contentsOf: await fetchLocations(for: route))
            }
            locations.sort { $0.timestamp < $1.timestamp }

            let hr = await fetchHRSummary(for: workout)
            let events = workout.workoutEvents ?? []
            let splits = locations.count >= 2
                ? SplitCalculator.kmSplits(from: locations, pauses: Self.pauseIntervals(from: workout))
                : []
            let sourceName = workout.sourceRevision.source.name
            let bundle = workout.sourceRevision.source.bundleIdentifier
            let brand = metadataString(workout, key: "HKWorkoutBrandName") ?? "-"
            let device = deviceDescription(workout)
            let metadataKeys = sortedMetadataKeys(workout).joined(separator: ",")
            let eventTypes = eventSummary(events)
            let activityTypeName = self.workoutActivityTypeName(workout.workoutActivityType)
            let splitPaces = splits.prefix(8)
                .map { String(format: "%d:%.0fs", $0.kilometer, $0.paceSecondsPerKm) }
                .joined(separator: ",")

            if distanceM > 0 { withDistance += 1 }
            if !routes.isEmpty && locations.count >= 2 { withRoute += 1 }
            if hr.availableCount > 0 { withHR += 1 }
            if !events.isEmpty { withEvents += 1 }
            if !splits.isEmpty { withSplits += 1 }

            Self.zeppDiagLogger.notice("[ZeppDiag] uuid=\(workout.uuid.uuidString, privacy: .public) source=\(sourceName, privacy: .public) bundle=\(bundle, privacy: .public) brand=\(brand, privacy: .public) device=\(device, privacy: .public) type=\(activityTypeName, privacy: .public) rawType=\(workout.workoutActivityType.rawValue, privacy: .public) start=\(df.string(from: workout.startDate), privacy: .public) end=\(df.string(from: workout.endDate), privacy: .public) durationS=\(String(format: "%.0f", workout.duration), privacy: .public) distanceM=\(String(format: "%.0f", distanceM), privacy: .public) calories=\(String(format: "%.0f", calories), privacy: .public) routes=\(routes.count, privacy: .public) routePoints=\(locations.count, privacy: .public) hrSamples=\(hr.availableCount, privacy: .public) hrLinkedSamples=\(hr.linkedCount, privacy: .public) hrSameSourceSamples=\(hr.sameSourceCount, privacy: .public) hrWindowSamples=\(hr.windowCount, privacy: .public) avgHR=\(String(format: "%.0f", hr.avgBPM ?? 0), privacy: .public) maxHR=\(String(format: "%.0f", hr.maxBPM ?? 0), privacy: .public) events=\(events.count, privacy: .public) eventTypes=\(eventTypes, privacy: .public) splits=\(splits.count, privacy: .public) splitPaces=\(splitPaces, privacy: .public) metadataKeys=\(metadataKeys, privacy: .public)")
        }

        if matches.isEmpty {
            Self.zeppDiagLogger.notice("[ZeppDiagSummary] scanned=\(workouts.count, privacy: .public) matched=0 hint=Nenhum treino Zepp/Amazfit encontrado. Verifique se o Zepp sincronizou com Apple Health e se a permissao de leitura de Workouts foi concedida.")
            return
        }

        Self.zeppDiagLogger.notice("[ZeppDiagSummary] scanned=\(workouts.count, privacy: .public) matched=\(matches.count, privacy: .public) withDistance=\(withDistance, privacy: .public) withRoute=\(withRoute, privacy: .public) withHR=\(withHR, privacy: .public) withEvents=\(withEvents, privacy: .public) withSplits=\(withSplits, privacy: .public)")
    }

    private func fetchLatestRawWorkouts(limit: Int) async -> [HKWorkout] {
        let workoutType = HKObjectType.workoutType()
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: nil,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    Self.zeppDiagLogger.error("[ZeppDiag] falha ao buscar workouts: \(error.localizedDescription, privacy: .public)")
                }
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(query)
        }
    }

    private func isZeppOrAmazfitWorkout(_ workout: HKWorkout) -> Bool {
        let metadataText = (workout.metadata ?? [:])
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: " ")
        var haystackParts: [String] = [
            workout.sourceRevision.source.name,
            workout.sourceRevision.source.bundleIdentifier,
            workout.sourceRevision.version ?? "",
            metadataText,
        ]

        if let device = workout.device {
            haystackParts.append(contentsOf: [
                device.name,
                device.manufacturer,
                device.model,
                device.hardwareVersion,
                device.firmwareVersion,
                device.softwareVersion,
                device.localIdentifier,
                device.udiDeviceIdentifier,
            ].compactMap { $0 })
        }

        let haystack = haystackParts
            .joined(separator: " ")
            .lowercased()

        return ["zepp", "amazfit", "huami"].contains { haystack.contains($0) }
    }

    private func isRunningWorkoutCandidate(_ workout: HKWorkout) -> Bool {
        if workout.workoutActivityType == .running {
            return true
        }

        guard workout.workoutActivityType == .other,
              isZeppOrAmazfitWorkout(workout) else {
            return false
        }

        let distanceMeters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
        guard distanceMeters >= 400, workout.duration >= 120 else {
            return false
        }

        let paceSecondsPerKm = workout.duration / (distanceMeters / 1000.0)
        return paceSecondsPerKm >= 150 && paceSecondsPerKm <= 900
    }

    private func deviceDescription(_ workout: HKWorkout) -> String {
        guard let device = workout.device else { return "-" }
        let parts = [
            device.name,
            device.manufacturer,
            device.model,
            device.hardwareVersion,
            device.firmwareVersion,
            device.softwareVersion,
            device.localIdentifier,
            device.udiDeviceIdentifier,
        ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? "-" : parts.joined(separator: "|")
    }

    private func queryWorkouts(
        sampleType: HKSampleType,
        predicate: NSPredicate?,
        limit: Int,
        sortDescriptors: [NSSortDescriptor]?
    ) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sampleType,
                predicate: predicate,
                limit: limit,
                sortDescriptors: sortDescriptors
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

    private func sortedMetadataKeys(_ workout: HKWorkout) -> [String] {
        Array((workout.metadata ?? [:]).keys).sorted()
    }

    private func metadataString(_ workout: HKWorkout, key: String) -> String? {
        guard let value = workout.metadata?[key] else { return nil }
        return String(describing: value)
    }

    private func eventSummary(_ events: [HKWorkoutEvent]) -> String {
        guard !events.isEmpty else { return "-" }
        let counts = Dictionary(grouping: events, by: { $0.type.rawValue })
            .mapValues(\.count)
        return counts
            .sorted { $0.key < $1.key }
            .map { "\($0.key):\($0.value)" }
            .joined(separator: ",")
    }

    private func workoutActivityTypeName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "running"
        case .walking: return "walking"
        case .cycling: return "cycling"
        case .hiking: return "hiking"
        case .traditionalStrengthTraining: return "strength"
        case .functionalStrengthTraining: return "functional_strength"
        case .highIntensityIntervalTraining: return "hiit"
        case .swimming: return "swimming"
        case .yoga: return "yoga"
        case .other: return "other"
        default: return "raw_\(type.rawValue)"
        }
    }

    private func fetchHRSummary(for workout: HKWorkout) async -> HeartRateSummary {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return HeartRateSummary(linkedCount: 0, sameSourceCount: 0, windowCount: 0, avgBPM: nil, maxBPM: nil)
        }
        let unit = HKUnit.count().unitDivided(by: .minute())
        let linkedPredicate = HKQuery.predicateForObjects(from: workout)
        let windowPredicate = HKQuery.predicateForSamples(withStart: workout.startDate, end: workout.endDate, options: .strictStartDate)

        async let linkedSamples = fetchHeartRateSamples(type: hrType, predicate: linkedPredicate, workoutID: workout.uuid.uuidString, label: "linked")
        async let windowSamples = fetchHeartRateSamples(type: hrType, predicate: windowPredicate, workoutID: workout.uuid.uuidString, label: "window")

        let linked = await linkedSamples
        let window = await windowSamples
        let sourceName = workout.sourceRevision.source.name
        let sourceBundle = workout.sourceRevision.source.bundleIdentifier
        let sameSource = window.filter { sample in
            sample.sourceRevision.source.name == sourceName ||
                sample.sourceRevision.source.bundleIdentifier == sourceBundle
        }
        let preferred = linked.isEmpty ? sameSource : linked
        let values = preferred
            .map { $0.quantity.doubleValue(for: unit) }
            .filter { $0 > 0 }

        guard !values.isEmpty else {
            return HeartRateSummary(
                linkedCount: linked.count,
                sameSourceCount: sameSource.count,
                windowCount: window.count,
                avgBPM: nil,
                maxBPM: nil
            )
        }

        let avg = values.reduce(0, +) / Double(values.count)
        return HeartRateSummary(
            linkedCount: linked.count,
            sameSourceCount: sameSource.count,
            windowCount: window.count,
            avgBPM: avg,
            maxBPM: values.max()
        )
    }

    private func fetchHeartRateSamples(type: HKQuantityType, predicate: NSPredicate, workoutID: String, label: String) async -> [HKQuantitySample] {
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: nil
            ) { _, samples, error in
                if let error {
                    Self.zeppDiagLogger.error("[ZeppDiag] falha ao buscar FC \(label, privacy: .public) para uuid=\(workoutID, privacy: .public): \(error.localizedDescription, privacy: .public)")
                }
                continuation.resume(returning: (samples as? [HKQuantitySample]) ?? [])
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
        let routes = await fetchRoutes(for: workout)
        guard !routes.isEmpty else { return [] }

        var all: [CLLocation] = []
        for route in routes {
            all.append(contentsOf: await fetchLocations(for: route))
        }
        all.sort { $0.timestamp < $1.timestamp }
        return all
    }

    private func fetchRoutes(for workout: HKWorkout) async -> [HKWorkoutRoute] {
        await withCheckedContinuation { (cont: CheckedContinuation<[HKWorkoutRoute], Never>) in
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
