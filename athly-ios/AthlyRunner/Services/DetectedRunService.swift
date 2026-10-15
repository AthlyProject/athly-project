import Foundation
import OSLog

/// O que a detecção encontrou para o pop-up "nova atividade".
enum DetectedRunCandidate: Identifiable, Sendable {
    /// Corrida do Apple Health que o Athly não iniciou nem vinculou.
    case healthKit(HealthKitRunItem)
    /// Corrida enviada pelo campo de dados da Athly no Garmin.
    case garmin(GarminDetectedRun)

    var id: String { summary.id }

    /// Resumo no formato que o pop-up mostra.
    var summary: HealthKitRunItem {
        switch self {
        case .healthKit(let run): return run
        case .garmin(let garmin): return garmin.summary
        }
    }
}

/// Corrida do campo de dados pronta para o pop-up: já normalizada como `ImportedWorkout`.
struct GarminDetectedRun: Sendable {
    let activityId: String
    let imported: ImportedWorkout
    let summary: HealthKitRunItem
    /// A mesma corrida no Apple Health (o Garmin Connect também grava lá, sem rota). É dispensada
    /// junto, para o pop-up não perguntar duas vezes pela mesma corrida.
    let matchingHealthKitUUIDs: [String]

    /// Chave no `DetectedRunAckStore` — guarda a decisão mesmo se o backend estiver fora.
    var ackKey: String { Self.ackKey(activityId) }

    static func ackKey(_ activityId: String) -> String { "garmin:\(activityId)" }
}

/// Detecta corridas que o Athly ainda não reivindicou: as enviadas pelo campo de dados do Garmin e
/// as do Apple Health — tipicamente gravadas pelo Apple Watch, Zepp/Amazfit, Garmin ou pelo app
/// Fitness, isto é, **não iniciadas pelo app**. A do Garmin vem primeiro: tem rota e passos do treino.
///
/// Os filtros são funções puras (`firstUnclaimed`, `garminStatus`) para serem testáveis sem
/// HealthKit nem rede; o wrapper assíncrono nunca propaga erro: a detecção é oportunista e não
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

    /// O que fazer com uma corrida do campo de dados.
    enum GarminStatus: Equatable {
        /// Oferecer no pop-up, dispensando junto estas corridas equivalentes do Apple Health.
        case offer(matchingHealthKitUUIDs: [String])
        /// O atleta já tratou a mesma corrida pelo Apple Health (vinculou, salvou ou ignorou) antes
        /// de o relógio terminar o envio: não perguntar de novo.
        case alreadyHandled
    }

    static func garminStatus(
        imported: ImportedWorkout,
        healthRuns: [HealthKitRunItem],
        localSessions: [RunSession],
        linkedUUIDs: Set<String>,
        acknowledgedUUIDs: Set<String>
    ) -> GarminStatus {
        let matching = healthRuns.filter { run in
            ImportedWorkoutMatch.evaluate(
                imported: imported,
                healthStartDate: run.startDate,
                healthDurationSeconds: run.durationSeconds,
                healthDistanceMeters: run.distanceMeters
            ).isMatch
        }
        let handledInHealth = matching.contains { run in
            linkedUUIDs.contains(run.id)
                || acknowledgedUUIDs.contains(run.id)
                || HealthKitRunMatch.isAlreadyLocal(run: run, sessions: localSessions)
        }
        if handledInHealth || isAlreadyLocal(imported: imported, sessions: localSessions) {
            return .alreadyHandled
        }
        return .offer(matchingHealthKitUUIDs: matching.map(\.id))
    }

    /// Mesmas tolerâncias de `HealthKitRunMatch`, na direção corrida importada × sessão local.
    static func isAlreadyLocal(imported: ImportedWorkout, sessions: [RunSession]) -> Bool {
        sessions.contains { session in
            abs(session.startDate.timeIntervalSince(imported.startDate)) < HealthKitRunMatch.startTolerance
                && abs(session.durationSeconds - imported.activeDurationSeconds) < HealthKitRunMatch.durationTolerance
                && abs(session.distanceMeters - imported.distanceMeters)
                    <= HealthKitRunMatch.distanceTolerance(for: imported.distanceMeters)
        }
    }

    /// Lê o backend e o Apple Health e devolve o que mostrar. Devolve `nil` em qualquer erro.
    @MainActor
    static func detect(localSessions: [RunSession], now: Date = Date()) async -> DetectedRunCandidate? {
        let health = await readHealth()
        let acknowledged = DetectedRunAckStore.shared.acknowledgedUUIDs()

        if let garmin = await detectGarmin(
            healthRuns: health.runs,
            localSessions: localSessions,
            linkedUUIDs: health.linked,
            acknowledgedUUIDs: acknowledged
        ) {
            logger.info("Corrida do campo de dados detectada: \(garmin.activityId, privacy: .public)")
            return .garmin(garmin)
        }

        let detected = firstUnclaimed(
            runs: health.runs,
            localSessions: localSessions,
            linkedUUIDs: health.linked,
            acknowledgedUUIDs: acknowledged,
            now: now
        )
        if let detected {
            logger.info("Corrida não reivindicada detectada: \(detected.id, privacy: .public)")
        }
        return detected.map(DetectedRunCandidate.healthKit)
    }

    @MainActor
    private static func readHealth() async -> (runs: [HealthKitRunItem], linked: Set<String>) {
        let service: any HealthKitRunningWorkoutsProviding = {
            #if targetEnvironment(simulator)
            return MockHealthKitService()
            #else
            return HealthKitService()
            #endif
        }()

        guard service.isHealthDataAvailable else { return ([], []) }

        do {
            try await service.requestReadAuthorization()
            let runs = try await service.fetchLatestRunningWorkouts(limit: 30)
            let linked = Set(runs.map(\.id))
                .subtracting(RunWorkoutLinkStore.shared.allOrphanCandidates(healthKitUUIDs: runs.map(\.id)))
            return (runs, linked)
        } catch {
            logger.info("Detecção no Health adiada: \(error.localizedDescription, privacy: .public)")
            return ([], [])
        }
    }

    /// Corrida mais recente do campo de dados ainda sem decisão. As que o atleta já tratou pelo
    /// Apple Health são encerradas no backend, para não voltarem.
    @MainActor
    private static func detectGarmin(
        healthRuns: [HealthKitRunItem],
        localSessions: [RunSession],
        linkedUUIDs: Set<String>,
        acknowledgedUUIDs: Set<String>
    ) async -> GarminDetectedRun? {
        let pending: [GarminActivitySummary]
        do {
            pending = try await APIClient.shared.pendingGarminActivities()
        } catch {
            logger.info("Corridas do Garmin indisponíveis: \(error.localizedDescription, privacy: .public)")
            return nil
        }

        for summary in pending where !acknowledgedUUIDs.contains(GarminDetectedRun.ackKey(summary.id)) {
            let imported: ImportedWorkout
            do {
                imported = try await APIClient.shared.garminActivity(id: summary.id).importedWorkout()
            } catch {
                logger.error("Corrida do Garmin ilegível id=\(summary.id, privacy: .public): \(error.localizedDescription, privacy: .public)")
                continue
            }
            switch garminStatus(
                imported: imported,
                healthRuns: healthRuns,
                localSessions: localSessions,
                linkedUUIDs: linkedUUIDs,
                acknowledgedUUIDs: acknowledgedUUIDs
            ) {
            case .alreadyHandled:
                DetectedRunAckStore.shared.acknowledge(healthKitUUID: GarminDetectedRun.ackKey(summary.id))
                try? await APIClient.shared.resolveGarminActivity(id: summary.id, resolution: .dismissed)
            case .offer(let matching):
                return GarminDetectedRun(
                    activityId: summary.id,
                    imported: imported,
                    summary: imported.detectedRunSummary(
                        id: GarminDetectedRun.ackKey(summary.id),
                        averageHeartRate: summary.avgHeartRate,
                        maximumHeartRate: summary.maxHeartRate
                    ),
                    matchingHealthKitUUIDs: matching
                )
            }
        }
        return nil
    }
}
