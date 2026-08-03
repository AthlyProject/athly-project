import Foundation
import CoreLocation

enum WorkoutSegmentationOrigin: String, Codable, Equatable, Sendable {
    case athlyTracker
    case prescribedRoute
    case prescribedTime
    case thirdPartyLaps
    case unavailable

    var displayName: String {
        switch self {
        case .athlyTracker:
            return "Registrado pelo Athly"
        case .prescribedRoute:
            return "Reconstruído pela rota"
        case .prescribedTime:
            return "Reconstruído por tempo"
        case .thirdPartyLaps:
            return "Laps do relógio"
        case .unavailable:
            return "Blocos indisponíveis"
        }
    }
}

enum WorkoutSegmentationConfidence: String, Codable, Equatable, Sendable {
    case exact
    case high
    case low
    case unavailable

    var displayName: String? {
        switch self {
        case .exact:
            return "Exato"
        case .high:
            return "Alta confiança"
        case .low:
            return "Baixa confiança"
        case .unavailable:
            return nil
        }
    }
}

/// Resultado único usado pela tela, persistência local e payload enviado ao backend.
/// `segments` fica vazio quando não há dados suficientes; nesse caso `fallbackReason`
/// explica por que o app manteve somente totais/splits reais em vez de inventar blocos.
struct WorkoutSegmentationResult: Codable, Equatable, Sendable {
    let segments: [SegmentRecord]
    let origin: WorkoutSegmentationOrigin
    let confidence: WorkoutSegmentationConfidence
    let fallbackReason: String?

    var hasSegments: Bool { !segments.isEmpty }

    static func unavailable(_ reason: String) -> WorkoutSegmentationResult {
        WorkoutSegmentationResult(
            segments: [],
            origin: .unavailable,
            confidence: .unavailable,
            fallbackReason: reason
        )
    }
}

/// Reconstrói os blocos prescritos sobre a linha do tempo real da atividade.
/// O motor não acessa HealthKit nem arquivos: os adaptadores entregam rota e pausas já normalizadas.
enum WorkoutSegmentationEngine {
    static func fromThirdPartyLaps(
        _ laps: [ActivityLap],
        fallbackReason: String? = nil
    ) -> WorkoutSegmentationResult? {
        let validLaps = laps.filter {
            $0.endDate > $0.startDate && ($0.distanceMeters > 5 || $0.durationSeconds > 3)
        }
        guard !validLaps.isEmpty else { return nil }

        return WorkoutSegmentationResult(
            segments: validLaps.map { lap in
                SegmentRecord(
                    kind: .unknown,
                    setIndex: lap.index,
                    setTotal: nil,
                    label: "Lap \(lap.index)",
                    startDate: lap.startDate,
                    endDate: lap.endDate,
                    distanceMeters: lap.distanceMeters,
                    durationSeconds: lap.durationSeconds,
                    skipped: false
                )
            },
            origin: .thirdPartyLaps,
            confidence: .high,
            fallbackReason: fallbackReason.map {
                "\($0) Exibindo os laps reais gravados pelo dispositivo."
            }
        )
    }

    static func reconstruct(
        prescription: WorkoutSegments?,
        startDate: Date,
        endDate: Date,
        route: [CLLocation],
        pauses: [SplitCalculator.PauseInterval]
    ) -> WorkoutSegmentationResult {
        guard let prescription else {
            return .unavailable("Este treino não possui uma estrutura de blocos para reconstruir.")
        }

        let steps = prescription
            .flatten()
            .filter { $0.kind != .rest && $0.kind != .unknown }
        guard !steps.isEmpty else {
            return .unavailable("A estrutura prescrita não possui blocos executáveis.")
        }
        guard endDate > startDate else {
            return .unavailable("A atividade não possui uma janela de tempo válida.")
        }

        let hasRoute = route.count >= 2
        let requiresDistance = steps.contains { $0.end.by == .distanceM }
        guard hasRoute || !requiresDistance else {
            return .unavailable(
                "A rota não está disponível. Como este treino possui blocos por distância, o Athly manteve apenas os totais e splits reais para não inventar os cortes."
            )
        }

        var cursor = startDate
        var records: [SegmentRecord] = []
        var lowConfidence = !hasRoute
        var reason: String? = hasRoute
            ? nil
            : "A atividade não possui rota; os blocos por tempo foram reconstruídos sem distância ou pace por bloco."

        for step in steps {
            guard cursor < endDate else {
                lowConfidence = true
                reason = partialReason(completed: records.count, expected: steps.count)
                break
            }

            let boundary: (date: Date, durationSeconds: Double, distanceMeters: Double)?
            switch step.end.by {
            case .distanceM:
                boundary = SplitCalculator.boundary(
                    afterDistanceMeters: step.end.value,
                    from: cursor,
                    locations: route,
                    pauses: pauses
                )
            case .durationSec:
                if hasRoute {
                    boundary = SplitCalculator.boundary(
                        afterMovingTimeSeconds: step.end.value,
                        from: cursor,
                        locations: route,
                        pauses: pauses
                    )
                } else {
                    boundary = timeBoundary(
                        afterActiveSeconds: step.end.value,
                        from: cursor,
                        endDate: endDate,
                        pauses: pauses
                    )
                }
            case .reps:
                boundary = nil
                lowConfidence = true
                reason = "Um dos blocos depende de repetições manuais e não pode ser reconstruído a partir da atividade."
            }

            guard let boundary, boundary.date > cursor else {
                lowConfidence = true
                reason = reason ?? partialReason(completed: records.count, expected: steps.count)
                break
            }

            let achievedFraction: Double
            switch step.end.by {
            case .distanceM:
                achievedFraction = boundary.distanceMeters / max(1, step.end.value)
            case .durationSec:
                achievedFraction = boundary.durationSeconds / max(1, step.end.value)
            case .reps:
                achievedFraction = 0
            }
            if achievedFraction < 0.8 {
                lowConfidence = true
                reason = partialReason(completed: records.count + 1, expected: steps.count)
            }

            records.append(SegmentRecord(
                kind: step.kind,
                setIndex: step.setIndex,
                setTotal: step.setTotal,
                label: step.label,
                startDate: cursor,
                endDate: min(boundary.date, endDate),
                distanceMeters: boundary.distanceMeters,
                durationSeconds: boundary.durationSeconds,
                skipped: false
            ))
            cursor = min(boundary.date, endDate)

            if achievedFraction < 0.8 { break }
        }

        guard !records.isEmpty else {
            return .unavailable(reason ?? "Não foi possível encontrar fronteiras confiáveis para os blocos.")
        }

        if records.count < steps.count {
            lowConfidence = true
            reason = reason ?? partialReason(completed: records.count, expected: steps.count)
        }

        return WorkoutSegmentationResult(
            segments: records,
            origin: hasRoute ? .prescribedRoute : .prescribedTime,
            confidence: lowConfidence ? .low : .high,
            fallbackReason: reason
        )
    }

    /// Identidade usada pelo analisador do backend. Preserva a semântica de tempo contínuo
    /// versus tiros, inclusive em pirâmides com vários blocos `work` fora de um `set`.
    static func backendIdentity(
        for record: SegmentRecord,
        at position: Int,
        in records: [SegmentRecord]
    ) -> (label: SegmentLabel, index: Int?) {
        switch record.kind {
        case .warmup:
            return (.warmup, nil)
        case .cooldown:
            return (.cooldown, nil)
        case .recovery:
            let ordinal = records.prefix(position + 1).filter { $0.kind == .recovery }.count
            return (.rec, record.setIndex ?? ordinal)
        case .work:
            let standaloneCount = records.filter { $0.kind == .work && $0.setIndex == nil }.count
            if record.setIndex != nil || standaloneCount >= 2 {
                let ordinal = records.prefix(position + 1).filter { $0.kind == .work }.count
                return (.rep, record.setIndex ?? ordinal)
            }
            return (.tempo, nil)
        case .rest, .set, .unknown:
            return (.easy, nil)
        }
    }

    private static func partialReason(completed: Int, expected: Int) -> String {
        "A atividade terminou antes da estrutura prescrita: \(completed) de \(expected) blocos puderam ser reconstruídos."
    }

    /// Avança tempo ativo sem rota, pulando pausas explícitas. Isso é legítimo para prescrições
    /// somente por duração, mas não produz distância nem pace por bloco.
    private static func timeBoundary(
        afterActiveSeconds target: Double,
        from startDate: Date,
        endDate: Date,
        pauses: [SplitCalculator.PauseInterval]
    ) -> (date: Date, durationSeconds: Double, distanceMeters: Double)? {
        guard target > 0, startDate < endDate else { return nil }

        let orderedPauses = pauses
            .filter { $0.end > startDate && $0.start < endDate }
            .sorted { $0.start < $1.start }
        var cursor = startDate
        var remaining = target

        for pause in orderedPauses {
            if pause.end <= cursor { continue }
            let activeEnd = min(max(pause.start, cursor), endDate)
            let available = max(0, activeEnd.timeIntervalSince(cursor))
            if remaining <= available {
                return (cursor.addingTimeInterval(remaining), target, 0)
            }
            remaining -= available
            cursor = min(max(cursor, pause.end), endDate)
            if cursor >= endDate { break }
        }

        let available = max(0, endDate.timeIntervalSince(cursor))
        let consumed = min(remaining, available)
        guard consumed > 0 else { return nil }
        let achieved = target - remaining + consumed
        return (cursor.addingTimeInterval(consumed), achieved, 0)
    }
}
