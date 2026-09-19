import Foundation

/// Melhor tempo do atleta em uma distância clássica, derivado do histórico local de corridas.
struct PersonalRecord: Identifiable, Sendable {
    let id: String
    let label: String
    let distanceKm: Double
    let durationSeconds: Double
    let date: Date
    /// `true` quando o tempo foi projetado pelo pace médio da corrida (sessão sem splits,
    /// caso de importações/Apple Health) em vez de medido em um trecho contínuo.
    let isEstimated: Bool

    var formattedTime: String {
        let total = Int(durationSeconds.rounded())
        let h = total / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}

/// Calcula os recordes pessoais a partir das corridas salvas localmente.
///
/// Quando a sessão tem splits, procura o trecho contínuo mais rápido que cobre a distância
/// (janela deslizante com interpolação nas pontas). Sem splits, projeta pelo pace médio e
/// marca o resultado como estimado.
enum PersonalRecordCalculator {
    struct RecordDistance {
        let id: String
        let label: String
        let km: Double
    }

    /// Tolerância para aceitar uma corrida que ficou marginalmente abaixo da distância alvo (GPS).
    private static let toleranceKm = 0.02

    static var distances: [RecordDistance] {
        [
            RecordDistance(id: "5k",  label: String(localized: "5 km"),            km: 5),
            RecordDistance(id: "10k", label: String(localized: "10 km"),           km: 10),
            RecordDistance(id: "21k", label: String(localized: "Meia maratona"),   km: 21.0975),
            RecordDistance(id: "42k", label: String(localized: "Maratona"),        km: 42.195),
        ]
    }

    static func records(from sessions: [RunSession]) -> [PersonalRecord] {
        distances.compactMap { distance in
            var best: PersonalRecord?
            for session in sessions {
                guard session.distanceKm + toleranceKm >= distance.km else { continue }
                guard let attempt = bestTime(forKm: distance.km, in: session) else { continue }
                if best == nil || attempt.seconds < (best?.durationSeconds ?? .infinity) {
                    best = PersonalRecord(
                        id: distance.id,
                        label: distance.label,
                        distanceKm: distance.km,
                        durationSeconds: attempt.seconds,
                        date: session.startDate,
                        isEstimated: attempt.estimated
                    )
                }
            }
            return best
        }
    }

    // MARK: - Private

    private static func bestTime(forKm target: Double, in session: RunSession) -> (seconds: Double, estimated: Bool)? {
        let segments: [(km: Double, seconds: Double)] = session.splits.compactMap { split in
            guard split.durationSeconds > 0, split.paceSecondsPerKm > 0 else { return nil }
            return (split.durationSeconds / split.paceSecondsPerKm, split.durationSeconds)
        }

        let covered = segments.reduce(0) { $0 + $1.km }
        if covered + toleranceKm >= target, let fastest = fastestWindow(target: target, in: segments) {
            return (fastest, false)
        }

        guard session.distanceKm + toleranceKm >= target, session.averagePaceSecondsPerKm > 0 else { return nil }
        return (session.averagePaceSecondsPerKm * target, true)
    }

    /// Menor tempo entre todas as janelas contínuas que somam `target` km.
    private static func fastestWindow(target: Double, in segments: [(km: Double, seconds: Double)]) -> Double? {
        guard !segments.isEmpty else { return nil }
        var best: Double?

        for start in segments.indices {
            var remaining = target
            var elapsed = 0.0
            var index = start

            while index < segments.count, remaining > 0 {
                let segment = segments[index]
                if segment.km >= remaining {
                    elapsed += segment.seconds * (remaining / segment.km)
                    remaining = 0
                } else {
                    elapsed += segment.seconds
                    remaining -= segment.km
                }
                index += 1
            }

            guard remaining <= toleranceKm else { continue }
            if best == nil || elapsed < (best ?? .infinity) { best = elapsed }
        }

        return best
    }
}
