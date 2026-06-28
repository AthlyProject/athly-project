import Foundation
import HealthKit
import CoreLocation

/// Builds a `DetailedSessionPayload` from an `HKWorkout` by pulling per-segment/per-lap events
/// and slicing heart-rate samples by time. When the workout has no explicit events, falls
/// back to per-kilometer splits synthesized from the workout's total duration/distance.
///
/// The output is consumed by the backend's `WorkoutExecutionAnalyzerService` to evaluate
/// interval adherence (tiros), pacing strategy, HR recovery between reps, etc.
final class WorkoutDetailFetcher: @unchecked Sendable {

    private let store: HKHealthStore

    init(store: HKHealthStore = HKHealthStore()) {
        self.store = store
    }

    /// Build the detailed payload for a single workout. Returns nil if authorization is missing
    /// or the workout has no usable data.
    func buildDetailedSession(
        for workout: HKWorkout,
        athlyWorkoutId: String?
    ) async throws -> DetailedSessionPayload? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let totalDistanceMeters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
        let activeDuration = (workout.metadata?["activeDurationSeconds"] as? Double) ?? workout.duration
        let avgPace: Double? = {
            guard totalDistanceMeters > 0 else { return nil }
            return activeDuration / (totalDistanceMeters / 1000.0)
        }()
        let calories = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie())

        let hrSamples = (try? await fetchHeartRateSamples(for: workout)) ?? []
        let hrStats = summarizeHR(samples: hrSamples)

        // Cadeia de fallback: segments do próprio app (metadata exata) > laps de terceiros
        // com rota (distância real interpolada) > GPS real (km splits) > splits sintéticos.
        var splitsSource: SplitsSource = .events
        var rawSegments = segmentsFromAthlyEvents(workout: workout)
        if rawSegments == nil {
            rawSegments = await segmentsFromThirdPartyEvents(workout: workout)
        }
        if rawSegments == nil {
            if let real = try? await realKmSplitsFromRoute(workout: workout) {
                rawSegments = real
                splitsSource = .route
            } else {
                rawSegments = syntheticKmSplits(
                    startDate: workout.startDate,
                    endDate: workout.endDate,
                    totalDistanceMeters: totalDistanceMeters,
                    totalDurationSeconds: activeDuration
                )
                splitsSource = .synthetic
            }
        }
        let segmentsRaw = rawSegments ?? []

        let segments = segmentsRaw.map { seg -> SegmentPayload in
            let hr = summarizeHR(samples: hrSamples, from: seg.start, to: seg.end)
            // Duração corrigida (pausa/buraco descontados) quando disponível — caso contrário,
            // o tempo de parede entre as fronteiras do segmento.
            let durationSeconds = seg.durationSeconds ?? seg.end.timeIntervalSince(seg.start)
            let pace: Double? = seg.distanceMeters > 0
                ? durationSeconds / (seg.distanceMeters / 1000.0)
                : nil
            return SegmentPayload(
                label: seg.label,
                index: seg.index,
                distanceKm: seg.distanceMeters / 1000.0,
                durationSeconds: durationSeconds,
                avgPaceSecondsPerKm: pace,
                avgHR: hr.avg,
                peakHR: hr.peak,
                endHR: hr.end
            )
        }

        return DetailedSessionPayload(
            startDate: iso.string(from: workout.startDate),
            appleHealthWorkoutUUID: workout.uuid.uuidString,
            athlyWorkoutId: athlyWorkoutId,
            distanceMeters: totalDistanceMeters,
            durationSeconds: activeDuration,
            averagePaceSecondsPerKm: avgPace,
            avgHR: hrStats.avg,
            maxHR: hrStats.peak,
            activeEnergyBurned: calories,
            elevationGainMeters: nil,
            segments: segments,
            splitsSource: splitsSource.rawValue
        )
    }

    enum SplitsSource: String {
        case events
        case route
        case synthetic
    }

    // MARK: - Segment extraction

    private struct RawSegment {
        let label: SegmentLabel
        let index: Int?
        let start: Date
        let end: Date
        let distanceMeters: Double
        /// Duração já corrigida (pausa/buraco descontados). Quando nil, o caller usa `end - start`.
        var durationSeconds: Double? = nil
    }

    /// Segmentos gravados pelo próprio app: HKWorkoutEvents(.segment) com metadata exata
    /// (kind, distância e duração ativa reais por segmento). Caminho de maior fidelidade —
    /// preserva a estrutura prescrita exatamente como foi executada.
    private func segmentsFromAthlyEvents(workout: HKWorkout) -> [RawSegment]? {
        let events = (workout.workoutEvents ?? []).filter {
            $0.type == .segment && $0.metadata?[HealthKitService.segmentKindMetadataKey] is String
        }
        guard !events.isEmpty else { return nil }

        let sorted = events.sorted(by: { $0.dateInterval.start < $1.dateInterval.start })

        // Works soltos (sem set): 1 = bloco contínuo (tempo run); 2+ = tiros de estrutura
        // heterogênea (pirâmide) — rotular como tempo faria o backend procurar reps e
        // concluir que o atleta não fez os tiros.
        let standaloneWorkCount = sorted.filter {
            ($0.metadata?[HealthKitService.segmentKindMetadataKey] as? String) == "work"
                && $0.metadata?[HealthKitService.segmentIndexMetadataKey] == nil
        }.count

        var repCounter = 0
        var recCounter = 0
        var segments: [RawSegment] = []
        for event in sorted {
            guard let kindRaw = event.metadata?[HealthKitService.segmentKindMetadataKey] as? String else { continue }
            let distance = (event.metadata?[HealthKitService.segmentDistanceMetadataKey] as? Double) ?? 0
            let duration = event.metadata?[HealthKitService.segmentDurationMetadataKey] as? Double
            let setIndex = event.metadata?[HealthKitService.segmentIndexMetadataKey] as? Int

            let label: SegmentLabel
            var idx: Int? = nil
            switch kindRaw {
            case "warmup":
                label = .warmup
            case "cooldown":
                label = .cooldown
            case "recovery":
                recCounter += 1
                label = .rec
                idx = setIndex ?? recCounter
            case "work":
                if setIndex != nil || standaloneWorkCount >= 2 {
                    repCounter += 1
                    label = .rep
                    idx = setIndex ?? repCounter
                } else {
                    label = .tempo
                }
            case "rest":
                continue
            default:
                label = .easy
            }

            segments.append(RawSegment(
                label: label,
                index: idx,
                start: event.dateInterval.start,
                end: event.dateInterval.end,
                distanceMeters: distance,
                durationSeconds: duration
            ))
        }
        return segments.isEmpty ? nil : segments
    }

    /// Laps de terceiros (`.segment`/`.lap` sem metadata do app). A distância de cada trecho
    /// vem da rota GPS interpolada nas fronteiras — ratear a distância total pelo tempo dava a
    /// TODO trecho o pace médio da sessão (pace fabricado), e a classificação rep/rec virava
    /// circular. Sem rota, retorna nil e o caller cai para totals-only (synthetic), que é o
    /// que o backend trata honestamente como "sem splits reais".
    private func segmentsFromThirdPartyEvents(workout: HKWorkout) async -> [RawSegment]? {
        let events = (workout.workoutEvents ?? []).filter {
            $0.type == .segment || $0.type == .lap
        }
        guard events.count >= 2 else { return nil }
        guard let locations = try? await fetchAllLocations(for: workout), locations.count >= 2 else {
            return nil
        }

        let boundaries = events
            .map { $0.dateInterval.start }
            .sorted()

        var ranges: [(start: Date, end: Date)] = []
        if let first = boundaries.first, first > workout.startDate {
            ranges.append((workout.startDate, first))
        }
        for i in 0..<boundaries.count {
            let start = boundaries[i]
            let end = i + 1 < boundaries.count ? boundaries[i + 1] : workout.endDate
            if end > start { ranges.append((start, end)) }
        }
        guard !ranges.isEmpty,
              let rangedDistances = SplitCalculator.distances(forRanges: ranges, from: locations, pauses: HealthKitService.pauseIntervals(from: workout)) else {
            return nil
        }

        // Heurística de fronteiras: primeiro trecho = warmup se >= 4 min, último = cooldown se >= 3 min.
        let warmupIdx = ranges.first.map { $0.end.timeIntervalSince($0.start) >= 240 ? 0 : -1 } ?? -1
        let cooldownIdx: Int = {
            guard let last = ranges.last else { return -1 }
            return last.end.timeIntervalSince(last.start) >= 180 ? ranges.count - 1 : -1
        }()

        // Paces reais dos trechos do meio. rep/rec é classificado pelo desvio relativo à
        // mediana — um limiar absoluto (ex.: 6:00/km) erra para corredores mais lentos ou
        // mais rápidos. Se os paces são todos parecidos (< 30s/km de spread), é corrida
        // contínua com auto-laps: nada é tiro.
        let middlePaces: [Double] = ranges.enumerated().compactMap { (i, range) in
            guard i != warmupIdx && i != cooldownIdx else { return nil }
            let duration = range.end.timeIntervalSince(range.start)
            return rangedDistances[i] > 50 ? duration / (rangedDistances[i] / 1000.0) : Double.infinity
        }
        let finitePaces = middlePaces.filter { $0.isFinite }.sorted()
        let median = finitePaces.isEmpty ? Double.infinity : finitePaces[finitePaces.count / 2]
        let spread = (finitePaces.last ?? 0) - (finitePaces.first ?? 0)
        let hasIntervalStructure = finitePaces.count >= 2 && spread >= 30

        var classified: [RawSegment] = []
        var repCounter = 0
        var recCounter = 0

        for (i, range) in ranges.enumerated() {
            let duration = range.end.timeIntervalSince(range.start)
            let pace = rangedDistances[i] > 50 ? duration / (rangedDistances[i] / 1000.0) : Double.infinity
            let label: SegmentLabel
            var idx: Int? = nil
            if i == warmupIdx {
                label = .warmup
            } else if i == cooldownIdx {
                label = .cooldown
            } else if hasIntervalStructure {
                let isRep = pace.isFinite && pace < median - 5
                if isRep {
                    repCounter += 1
                    label = .rep
                    idx = repCounter
                } else {
                    recCounter += 1
                    label = .rec
                    idx = recCounter
                }
            } else {
                label = .easy
            }
            classified.append(RawSegment(
                label: label,
                index: idx,
                start: range.start,
                end: range.end,
                distanceMeters: rangedDistances[i]
            ))
        }
        return classified
    }

    // MARK: - GPS-based real splits

    /// Lê o `HKWorkoutRoute` do treino e quebra os locations em segmentos reais de 1km.
    /// Retorna nil se não houver rota (ex.: esteira, treino sem GPS) — caller cai no synthetic.
    private func realKmSplitsFromRoute(workout: HKWorkout) async throws -> [RawSegment]? {
        let locations = try await fetchAllLocations(for: workout)
        guard locations.count >= 2 else { return nil }

        // Mesmo algoritmo dos splits da tela: filtro de salto por velocidade, exclusão de
        // pausa/buraco e fronteiras exatas — para o pace do analisador bater com o do app.
        let splits = SplitCalculator.kmSplits(from: locations, pauses: HealthKitService.pauseIntervals(from: workout))
        guard !splits.isEmpty else { return nil }

        return splits.map { split in
            RawSegment(
                label: .easy,
                index: nil,
                start: split.startDate,
                end: split.endDate,
                distanceMeters: split.distanceMeters,
                durationSeconds: split.durationSeconds
            )
        }
    }

    /// Todas as CLLocations da(s) rota(s) do treino, na ordem. Vazio quando não há rota.
    private func fetchAllLocations(for workout: HKWorkout) async throws -> [CLLocation] {
        let routes = try await fetchRoutes(for: workout)
        guard !routes.isEmpty else { return [] }
        var locations: [CLLocation] = []
        for route in routes {
            let routeLocs = try await fetchLocations(for: route)
            locations.append(contentsOf: routeLocs)
        }
        return locations
    }

    private func fetchRoutes(for workout: HKWorkout) async throws -> [HKWorkoutRoute] {
        let predicate = HKQuery.predicateForObjects(from: workout)
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[HKWorkoutRoute], Error>) in
            let query = HKAnchoredObjectQuery(
                type: HKSeriesType.workoutRoute(),
                predicate: predicate,
                anchor: nil,
                limit: HKObjectQueryNoLimit
            ) { _, samples, _, _, error in
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                cont.resume(returning: (samples as? [HKWorkoutRoute]) ?? [])
            }
            self.store.execute(query)
        }
    }

    private func fetchLocations(for route: HKWorkoutRoute) async throws -> [CLLocation] {
        let buffer = LocationsBuffer()
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[CLLocation], Error>) in
            let query = HKWorkoutRouteQuery(route: route) { _, locations, done, error in
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                if let locations { buffer.append(locations) }
                if done { cont.resume(returning: buffer.snapshot()) }
            }
            self.store.execute(query)
        }
    }

    private final class LocationsBuffer: @unchecked Sendable {
        private var items: [CLLocation] = []
        private let lock = NSLock()
        func append(_ new: [CLLocation]) {
            lock.lock(); defer { lock.unlock() }
            items.append(contentsOf: new)
        }
        func snapshot() -> [CLLocation] {
            lock.lock(); defer { lock.unlock() }
            return items
        }
    }

    /// Fallback when there are no workout events: one segment per kilometer.
    /// Labelled `.easy` by default so the AI treats it as a steady run — backend analyzer
    /// will still compute variance/pacing trend on the synthetic splits.
    private func syntheticKmSplits(
        startDate: Date,
        endDate: Date,
        totalDistanceMeters: Double,
        totalDurationSeconds: Double
    ) -> [RawSegment] {
        guard totalDistanceMeters >= 1000, totalDurationSeconds > 0 else {
            return [RawSegment(
                label: .easy,
                index: nil,
                start: startDate,
                end: endDate,
                distanceMeters: totalDistanceMeters
            )]
        }

        let avgPace = totalDurationSeconds / (totalDistanceMeters / 1000.0)
        let fullKms = Int(totalDistanceMeters / 1000.0)
        var segments: [RawSegment] = []
        var cursor = startDate

        for _ in 0..<fullKms {
            let segEnd = cursor.addingTimeInterval(avgPace)
            segments.append(RawSegment(
                label: .easy,
                index: nil,
                start: cursor,
                end: segEnd,
                distanceMeters: 1000
            ))
            cursor = segEnd
        }

        // Trailing fractional km
        if cursor < endDate {
            let leftoverDistance = totalDistanceMeters - Double(fullKms) * 1000
            if leftoverDistance > 50 {
                segments.append(RawSegment(
                    label: .easy,
                    index: nil,
                    start: cursor,
                    end: endDate,
                    distanceMeters: leftoverDistance
                ))
            }
        }

        return segments
    }

    // MARK: - Heart rate

    private struct HRStats {
        let avg: Double?
        let peak: Double?
        let end: Double?
    }

    private func summarizeHR(samples: [HKQuantitySample]) -> HRStats {
        summarizeHR(samples: samples, from: nil, to: nil)
    }

    private func summarizeHR(
        samples: [HKQuantitySample],
        from start: Date?,
        to end: Date?
    ) -> HRStats {
        let unit = HKUnit.count().unitDivided(by: .minute())
        let filtered: [HKQuantitySample] = {
            guard let start, let end else { return samples }
            return samples.filter { $0.startDate >= start && $0.endDate <= end }
        }()
        guard !filtered.isEmpty else { return HRStats(avg: nil, peak: nil, end: nil) }

        var sum: Double = 0
        var peak: Double = 0
        for sample in filtered {
            let v = sample.quantity.doubleValue(for: unit)
            sum += v
            if v > peak { peak = v }
        }
        let avg = sum / Double(filtered.count)
        let last = filtered.max(by: { $0.endDate < $1.endDate })?.quantity.doubleValue(for: unit)
        return HRStats(avg: avg, peak: peak, end: last)
    }

    private func fetchHeartRateSamples(for workout: HKWorkout) async throws -> [HKQuantitySample] {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return []
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: workout.startDate,
            end: workout.endDate,
            options: .strictStartDate
        )
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: hrType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (samples as? [HKQuantitySample]) ?? [])
            }
            self.store.execute(query)
        }
    }
}
