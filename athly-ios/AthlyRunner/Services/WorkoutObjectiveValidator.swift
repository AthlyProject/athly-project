import Foundation

/// Validação local (sem I.A.) que decide se o atleta atingiu o objetivo de um treino de tentativa
/// (`isGoalAttempt`) ao fim dele, comparando o resultado real (HealthKit / tracker) com a meta
/// planejada do treino. Critério escolhido pelo produto: **distância + pace**.
///
/// Regra: bateu a distância (≥ 95% da planejada) E o pace (≤ 5% mais lento que o alvo). Metas
/// ausentes são tratadas como satisfeitas (não dá para reprovar pelo que não foi prescrito).
enum WorkoutObjectiveValidator {
    /// Aceita até 5% a menos de distância e até 5% mais lento que o pace alvo.
    static let distanceTolerance = 0.95
    static let paceTolerance = 1.05

    static func isObjectiveAchieved(
        workout: WorkoutModel,
        actualDistanceMeters: Double,
        actualDurationSeconds: Double,
        actualPaceSecPerKm: Double
    ) -> Bool {
        guard workout.isGoalAttempt == true else { return false }

        let actualKm = actualDistanceMeters / 1000.0
        guard actualKm > 0 else { return false }

        let plannedKm = plannedDistanceKm(for: workout)
        let targetPace = targetPaceSecPerKm(for: workout)

        // Pace real: usa o informado quando válido, senão deriva de distância/tempo.
        let effectivePace: Double = {
            if actualPaceSecPerKm > 0, actualPaceSecPerKm.isFinite { return actualPaceSecPerKm }
            guard actualDurationSeconds > 0 else { return 0 }
            return actualDurationSeconds / actualKm
        }()

        let distanceOK = plannedKm <= 0 ? true : actualKm >= plannedKm * distanceTolerance
        let paceOK: Bool = {
            guard let target = targetPace, target > 0 else { return true }
            guard effectivePace > 0 else { return false }
            return effectivePace <= target * paceTolerance
        }()

        return distanceOK && paceOK
    }

    // MARK: - Extração da meta planejada

    /// Distância planejada (km): soma dos blocos; cai nos segmentos quando não há blocos com distância.
    private static func plannedDistanceKm(for workout: WorkoutModel) -> Double {
        let fromBlocks = workout.blocks.compactMap { $0.distance }.reduce(0, +)
        if fromBlocks > 0 { return fromBlocks }
        guard let segments = workout.segments?.segments else { return 0 }
        return segments.reduce(0) { $0 + distanceMeters(in: $1) } / 1000.0
    }

    /// Pace alvo (s/km): bloco de maior distância com `targetPace`; senão 1º bloco com pace; senão segmentos.
    private static func targetPaceSecPerKm(for workout: WorkoutModel) -> Double? {
        let paced = workout.blocks.filter { $0.targetPace != nil }
        let chosen = paced.max { ($0.distance ?? 0) < ($1.distance ?? 0) } ?? paced.first
        if let pace = chosen?.targetPace, let secs = parsePace(pace) { return secs }

        guard let segments = workout.segments?.segments else { return nil }
        return segmentTargetPace(in: segments)
    }

    /// "M:SS" (ex.: "5:12") → segundos por km. Tolera espaços e sufixos como "/km".
    private static func parsePace(_ raw: String) -> Double? {
        let cleaned = raw.split(separator: "/").first.map(String.init) ?? raw
        let parts = cleaned.trimmingCharacters(in: .whitespaces).split(separator: ":")
        guard parts.count == 2, let m = Int(parts[0]), let s = Int(parts[1]) else { return nil }
        return Double(m * 60 + s)
    }

    // MARK: - Fallback recursivo via árvore de segmentos

    private static func distanceMeters(in segment: Segment) -> Double {
        let reps = max(segment.repetitions ?? 1, 1)
        var total = 0.0
        if let end = segment.end, end.by == .distanceM { total += end.value }
        if let children = segment.children {
            total += children.reduce(0) { $0 + distanceMeters(in: $1) }
        }
        return total * Double(reps)
    }

    private static func segmentTargetPace(in segments: [Segment]) -> Double? {
        for segment in segments {
            if segment.kind == .work, let target = segment.target {
                if let max = target.paceSecPerKmMax { return Double(max) }
                if let min = target.paceSecPerKmMin { return Double(min) }
            }
            if let children = segment.children, let nested = segmentTargetPace(in: children) {
                return nested
            }
        }
        return nil
    }
}
