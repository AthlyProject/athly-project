import Foundation

/// Tolerâncias compartilhadas para decidir se uma corrida do Apple Health e uma `RunSession`
/// local são o mesmo treino. Extraído de `HealthKitRunsView` para ser reutilizado pela
/// detecção automática (`DetectedRunService`), que precisa exatamente da mesma regra para
/// **não** oferecer de volta uma corrida que o próprio Athly gravou.
enum HealthKitRunMatch {
    static let startTolerance: TimeInterval = 120
    static let durationTolerance: TimeInterval = 180

    /// Tolerância de distância proporcional, com piso de 100 m (GPS diverge entre fontes).
    static func distanceTolerance(for distanceMeters: Double) -> Double {
        max(100, distanceMeters * 0.03)
    }

    /// Heurística de equivalência: início, duração e distância precisam concordar.
    static func matches(session: RunSession, run: HealthKitRunItem) -> Bool {
        abs(session.startDate.timeIntervalSince(run.startDate)) < startTolerance
            && abs(session.durationSeconds - run.durationSeconds) < durationTolerance
            && abs(session.distanceMeters - run.distanceMeters) <= distanceTolerance(for: run.distanceMeters)
    }

    /// `true` quando a corrida do Health já está representada por uma sessão local — seja pelo
    /// UUID gravado na sincronização, seja pela heurística acima (sessões antigas, ou gravadas
    /// antes de o UUID voltar do HealthKit).
    static func isAlreadyLocal(run: HealthKitRunItem, sessions: [RunSession]) -> Bool {
        sessions.contains { session in
            if let uuid = session.healthKitWorkoutUUID, uuid == run.id { return true }
            return matches(session: session, run: run)
        }
    }

    /// Espelho de `isAlreadyLocal` na direção oposta, usado pela lista de histórico para não
    /// exibir a mesma corrida duas vezes (uma do Health, outra local).
    static func isDuplicate(session: RunSession, healthRuns: [HealthKitRunItem]) -> Bool {
        if let uuid = session.healthKitWorkoutUUID,
           healthRuns.contains(where: { $0.id == uuid }) {
            return true
        }
        return healthRuns.contains { matches(session: session, run: $0) }
    }
}
