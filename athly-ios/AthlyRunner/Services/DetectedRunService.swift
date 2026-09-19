import Foundation
import OSLog

/// Detecta corridas do Apple Health que o Athly ainda não reivindicou — tipicamente gravadas
/// pelo Apple Watch, Zepp/Amazfit, Garmin ou pelo app Fitness, isto é, **não iniciadas pelo app**.
///
/// O filtro é uma função pura (`firstUnclaimed`) para ser testável sem HealthKit; o wrapper
/// assíncrono só cuida de ler do Health e nunca propaga erro: a detecção é oportunista e não
/// deve gerar UI de falha.
enum DetectedRunService {
    /// Janela de detecção: dia atual + 2 dias anteriores. Mesma janela (D, D+1, D+2) que
    /// `WorkoutCompletionSheet` já usa para casar corrida e treino prescrito.
    static let windowDays = 2

    private static let logger = Logger(subsystem: "com.athly.runner", category: "DetectedRun")

    /// Regra de detecção. Devolve a corrida **mais recente** ainda não reivindicada, ou `nil`.
    ///
    /// - Parameters:
    ///   - runs: corridas lidas do Apple Health.
    ///   - localSessions: histórico local (`RunStore.sessions`) — identifica corridas do próprio Athly.
    ///   - linkedUUIDs: UUIDs já vinculados a um treino prescrito (`RunWorkoutLinkStore`).
    ///   - acknowledgedUUIDs: UUIDs dispensados pelo atleta (`DetectedRunAckStore`).
    static func firstUnclaimed(
        runs: [HealthKitRunItem],
        localSessions: [RunSession],
        linkedUUIDs: Set<String>,
        acknowledgedUUIDs: Set<String>,
        now: Date = Date(),
        calendar: Calendar = .current
    ) -> HealthKitRunItem? {
        guard let windowStart = calendar.date(
            byAdding: .day,
            value: -windowDays,
            to: calendar.startOfDay(for: now)
        ) else { return nil }

        return runs
            .filter { $0.startDate >= windowStart && $0.startDate <= now }
            .filter { !linkedUUIDs.contains($0.id) }
            .filter { !acknowledgedUUIDs.contains($0.id) }
            .filter { !HealthKitRunMatch.isAlreadyLocal(run: $0, sessions: localSessions) }
            .max { $0.startDate < $1.startDate }
    }

    /// Lê o Apple Health e aplica `firstUnclaimed`. Devolve `nil` em qualquer erro.
    @MainActor
    static func detect(localSessions: [RunSession], now: Date = Date()) async -> HealthKitRunItem? {
        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()

        guard service.isHealthDataAvailable else { return nil }

        do {
            try await service.requestReadAuthorization()
            let runs = try await service.fetchLatestRunningWorkouts(limit: 30)
            let linked = Set(runs.map(\.id))
                .subtracting(RunWorkoutLinkStore.shared.allOrphanCandidates(healthKitUUIDs: runs.map(\.id)))

            let detected = firstUnclaimed(
                runs: runs,
                localSessions: localSessions,
                linkedUUIDs: linked,
                acknowledgedUUIDs: DetectedRunAckStore.shared.acknowledgedUUIDs(),
                now: now
            )
            if let detected {
                logger.info("Corrida não reivindicada detectada: \(detected.id, privacy: .public)")
            }
            return detected
        } catch {
            logger.info("Detecção adiada: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}
