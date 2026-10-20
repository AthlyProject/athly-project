import Foundation

/// Cenários de teste do planner no simulador. As contas `cenario-<nome>@...` vêm do seed
/// `athly-backend/cenarios.sh seed`; qualquer outra conta vê o "dono do iPhone" padrão.
enum SimulatorHealthScenario: String, CaseIterable, Sendable {
    /// Relógio de terceiros (Garmin, Nike…) via Apple Health: só totais, sem FC nem rota.
    case resumo
    /// iPhone/Apple Watch com GPS e FC, mas condicionamento baixo (pace lento, FC alta, cai no fim).
    case gps
    /// Nenhuma corrida no Health: o backend gera o plano de avaliação (cold start).
    case vazio
    /// GPS e FC com condicionamento intermediário (VDOT ~39): FC moderada, quase sem queda de pace.
    case medio
    /// Só totais, como o "resumo", mas de um corredor forte (VDOT ~50, ~50 km/semana).
    case veloz
    case padrao

    static func current() async -> SimulatorHealthScenario {
        // Força o cenário com qualquer conta: scheme do Xcode ou o eval de `cenarios.sh`.
        if let forced = ProcessInfo.processInfo.environment["ATHLY_HEALTH_SCENARIO"].flatMap(Self.init(rawValue:)) {
            return forced
        }
        #if targetEnvironment(simulator)
        let email = await APIClient.shared.simulatorAccountEmail
        #else
        let email: String? = nil
        #endif
        guard let local = email?.lowercased().split(separator: "@").first else { return .padrao }
        return allCases.first { $0 != .padrao && local.hasPrefix("cenario-\($0.rawValue)") } ?? .padrao
    }
}

/// Dados mockados do Health no simulador: corridas tipadas para testes sem Health real.
/// Usado automaticamente quando o app roda no simulador (HealthKit indisponível).
final class MockHealthKitService: HealthKitRunningWorkoutsProviding, HeartRateHealthProviding, Sendable {

    var isHealthDataAvailable: Bool { true }

    func requestReadAuthorization() async throws {
        // No mock não há autorização real.
    }

    func requestWriteAuthorization() async throws -> HealthKitWriteAuthorizationSnapshot {
        .fullyAuthorized
    }

    func diagnose(windowStart: Date, windowEnd: Date, contextLabel: String) async {
        // No-op no simulador — diagnóstico só faz sentido em dispositivo físico.
    }

    func diagnoseZeppWorkouts(limit: Int) async {
        // No-op no simulador — diagnóstico só faz sentido em dispositivo físico.
    }

    func fetchLatestRunningWorkouts(limit: Int = 20) async throws -> [HealthKitRunItem] {
        try await fetchRunningWorkoutsPage(limit: limit, beforeEndDate: nil)
    }

    func fetchRunningWorkoutsPage(limit: Int = 20, beforeEndDate: Date? = nil) async throws -> [HealthKitRunItem] {
        try await Task.sleep(nanoseconds: 400_000_000) // 0,4 s para simular rede/IO
        let filteredRuns = await Self.currentRuns().filter { run in
            guard let beforeEndDate else { return true }
            return run.endDate < beforeEndDate
        }
        return filteredRuns.prefix(limit).map { $0 }
    }

    func fetchRunningWorkout(uuid: String) async throws -> HealthKitRunItem? {
        await Self.currentRuns().first { $0.id == uuid }
    }

    /// Sessões detalhadas como o `WorkoutDetailFetcher` montaria no aparelho: splits reais da rota
    /// nos cenários com GPS, splits sintéticos (pace médio, sem FC) nos só de totais, nenhuma no padrão.
    func detailedSessions(limit: Int) async -> [DetailedSessionPayload] {
        let scenario = await SimulatorHealthScenario.current()
        let splitsSource: String
        switch scenario {
        case .gps, .medio: splitsSource = "route"
        case .resumo, .veloz: splitsSource = "synthetic"
        case .vazio, .padrao: return []
        }
        let now = Date()
        return Self.specs(for: scenario).prefix(limit).map {
            Self.detailedSession(now: now, run: $0, splitsSource: splitsSource)
        }
    }

    // MARK: - FC de repouso

    func requestHeartRateReadAuthorization() async throws {
        // No mock não há autorização real.
    }

    /// FC de repouso medida ontem, como o Apple Health daria. Só o "medio" tem: com ela o backend
    /// calcula as zonas e prescreve por FC + RPE; os demais cenários ficam no modo RPE.
    func fetchRestingHeartRate() async throws -> HeartRateHealthSnapshot? {
        guard await SimulatorHealthScenario.current() == .medio else { return nil }
        let now = Date()
        return HeartRateHealthSnapshot(restingHeartRate: 56, measuredAt: now.addingTimeInterval(-86_400), capturedAt: now)
    }

    // MARK: - Cenários

    private static let calendar = Calendar.current

    private static func currentRuns() async -> [HealthKitRunItem] {
        let now = Date()
        let scenario = await SimulatorHealthScenario.current()
        let bundle = sourceBundle(for: scenario)
        return specs(for: scenario).map { buildItem(now: now, run: $0, sourceBundle: bundle) }
    }

    /// App que gravou o treino, como o HealthKit informa: o backend só trata como medida um treino
    /// registrado por um app, não digitado à mão.
    private static func sourceBundle(for scenario: SimulatorHealthScenario) -> String {
        switch scenario {
        case .resumo, .veloz: return "com.garmin.connect.mobile"
        case .gps, .medio, .vazio, .padrao: return "com.apple.health"
        }
    }

    /// UUID determinístico a partir do id legível do cenário: o HealthKit real usa UUIDs, e o backend
    /// só aceita como medida um treino identificado por UUID.
    private static func mockUUID(_ name: String) -> String {
        var a: UInt64 = 0xcbf29ce484222325
        var b: UInt64 = 0x84222325cbf29ce4
        for byte in name.utf8 {
            a = (a ^ UInt64(byte)) &* 0x100000001b3
            b = (b ^ UInt64(byte)) &* 0x100000001b3 &+ 0x9e3779b97f4a7c15
        }
        let hex = Array(String(format: "%016llx%016llx", a, b))
        let part = { (range: Range<Int>) in String(hex[range]) }
        return "\(part(0..<8))-\(part(8..<12))-4\(part(13..<16))-8\(part(17..<20))-\(part(20..<32))".uppercased()
    }

    private static func specs(for scenario: SimulatorHealthScenario) -> [RunSpec] {
        switch scenario {
        case .resumo: return resumoRuns
        case .gps: return gpsRuns
        case .vazio: return []
        case .medio: return medioRuns
        case .veloz: return velozRuns
        case .padrao: return simulatorOwnerRuns
        }
    }

    /// ~3 corridas/semana nas últimas 8 semanas, 5–13 km a 5:38–6:18/km, longão de domingo.
    private static var resumoRuns: [RunSpec] {
        // (dias atrás, km, pace s/km)
        let runs: [(Int, Double, Int)] = [
            (1, 6.2, 362), (3, 8.0, 355), (5, 5.0, 340), (8, 12.1, 372), (10, 6.0, 360),
            (12, 7.5, 351), (15, 10.0, 368), (17, 5.2, 338), (19, 6.8, 358), (22, 13.0, 378),
            (24, 6.0, 361), (26, 5.0, 345), (29, 11.0, 370), (31, 6.4, 357), (36, 9.0, 366),
            (40, 6.0, 360), (43, 10.5, 372), (47, 5.5, 350), (50, 8.0, 364), (54, 6.0, 362),
        ]
        return runs.enumerated().map { index, run in
            let (daysAgo, km, pace) = run
            return RunSpec(
                id: String(format: "resumo-run-%02d", index + 1),
                daysAgo: daysAgo,
                hour: [6, 7, 18][index % 3],
                minute: [10, 40, 5][index % 3],
                durationSeconds: km * Double(pace),
                distanceKm: km,
                calories: (km * 74).rounded(),
                elevation: nil
            )
        }
    }

    /// ~2 corridas/semana nas últimas 6 semanas, 3,5–8 km a 6:50–7:28/km com FC média 160–167:
    /// esforço alto para o ritmo, e o pace cai nos km finais (no longão de 8 km, bastante).
    private static var gpsRuns: [RunSpec] {
        // (dias atrás, km, pace s/km, FC média, FC máx, fade)
        let runs: [(Int, Double, Int, Int, Int, Double)] = [
            (2, 5.0, 425, 164, 181, 0.10), (5, 4.2, 418, 162, 179, 0.08), (9, 8.0, 448, 166, 186, 0.22),
            (12, 5.0, 430, 165, 182, 0.10), (16, 3.5, 410, 160, 176, 0.06), (19, 6.0, 437, 163, 183, 0.14),
            (23, 5.0, 428, 164, 180, 0.10), (27, 4.0, 420, 161, 178, 0.08), (33, 6.5, 445, 167, 185, 0.16),
            (38, 5.0, 432, 165, 181, 0.10),
        ]
        return runs.enumerated().map { index, run in
            let (daysAgo, km, pace, avgHR, maxHR, fade) = run
            return RunSpec(
                id: String(format: "gps-run-%02d", index + 1),
                daysAgo: daysAgo,
                hour: [19, 6][index % 2],
                minute: [20, 50][index % 2],
                durationSeconds: km * Double(pace),
                distanceKm: km,
                calories: (km * 68).rounded(),
                elevation: Double(12 + (index % 4) * 9),
                avgHR: Double(avgHR),
                maxHR: Double(maxHR),
                fade: fade
            )
        }
    }

    /// ~3 corridas/semana nas últimas 7 semanas (~25 km/semana), 5–13 km. Rodagens a 5:33–5:44/km
    /// com FC 145–151; um treino forte por semana (5 km a 4:58, 8 km a 5:18) com FC 157–166.
    private static var medioRuns: [RunSpec] {
        // (dias atrás, km, pace s/km, FC média, FC máx, fade)
        let runs: [(Int, Double, Int, Int, Int, Double)] = [
            (1, 12.0, 338, 148, 165, 0.04), (3, 6.0, 312, 160, 172, 0.03), (5, 7.0, 335, 146, 160, 0.03),
            (8, 11.0, 340, 149, 166, 0.05), (10, 5.0, 298, 166, 178, 0.02), (12, 7.0, 333, 145, 159, 0.03),
            (15, 13.0, 342, 150, 168, 0.06), (17, 8.0, 318, 158, 171, 0.03), (19, 6.0, 336, 146, 161, 0.03),
            (22, 10.0, 339, 148, 164, 0.05), (24, 6.0, 314, 159, 171, 0.03), (26, 7.0, 334, 145, 160, 0.03),
            (29, 12.0, 344, 151, 168, 0.06), (31, 5.0, 305, 163, 175, 0.02), (33, 6.0, 337, 146, 160, 0.03),
            (36, 10.0, 341, 149, 165, 0.05), (38, 8.0, 320, 157, 170, 0.03), (40, 6.0, 338, 146, 161, 0.03),
            (43, 9.0, 343, 149, 165, 0.05), (45, 6.0, 316, 158, 170, 0.03), (47, 5.0, 336, 145, 159, 0.03),
        ]
        return runs.enumerated().map { index, run in
            let (daysAgo, km, pace, avgHR, maxHR, fade) = run
            return RunSpec(
                id: String(format: "medio-run-%02d", index + 1),
                daysAgo: daysAgo,
                hour: [6, 19, 7][index % 3],
                minute: [0, 10, 30][index % 3],
                durationSeconds: km * Double(pace),
                distanceKm: km,
                calories: (km * 60).rounded(),
                elevation: Double(20 + (index % 5) * 11),
                avgHR: Double(avgHR),
                maxHR: Double(maxHR),
                fade: fade
            )
        }
    }

    /// ~4,5 corridas/semana nas últimas 6 semanas (~50 km/semana), sem FC nem rota. Rodagens a
    /// 4:45–4:58/km, longão de domingo de 14–21 km e treinos fortes (5 km a 3:58, 10 km a 4:10).
    /// São 27 corridas: o app manda só as 20 mais recentes (~4 semanas).
    private static var velozRuns: [RunSpec] {
        // (dias atrás, km, pace s/km)
        let runs: [(Int, Double, Int)] = [
            (1, 18.0, 292), (3, 10.0, 255), (4, 8.0, 290), (6, 5.0, 238), (7, 9.0, 285),
            (8, 16.0, 295), (10, 12.0, 262), (11, 8.0, 292), (13, 10.0, 250), (14, 8.0, 288),
            (15, 21.1, 287), (17, 8.0, 290), (18, 10.0, 258), (20, 8.0, 295),
            (22, 15.0, 293), (24, 6.0, 245), (25, 9.0, 287), (27, 10.0, 262), (28, 8.0, 291),
            (29, 17.0, 296), (31, 8.0, 289), (32, 12.0, 268), (34, 8.0, 293),
            (36, 14.0, 298), (38, 10.0, 265), (39, 8.0, 292), (41, 8.0, 290),
        ]
        return runs.enumerated().map { index, run in
            let (daysAgo, km, pace) = run
            return RunSpec(
                id: String(format: "veloz-run-%02d", index + 1),
                daysAgo: daysAgo,
                hour: [5, 6, 18][index % 3],
                minute: [45, 20, 30][index % 3],
                durationSeconds: km * Double(pace),
                distanceKm: km,
                calories: (km * 68).rounded(),
                elevation: nil
            )
        }
    }

    /// Dados do "dono do iPhone" do simulador, para contas fora dos cenários.
    private static var simulatorOwnerRuns: [RunSpec] {
        let featuredRuns = [
            run(
                id: "mock-run-1",
                daysAgo: 0,
                hour: 7,
                minute: 30,
                durationMinutes: 32,
                distanceKm: 5.12,
                calories: 312,
                elevation: 28
            ),
            run(
                id: "mock-run-2",
                daysAgo: 2,
                hour: 18,
                minute: 15,
                durationMinutes: 28,
                distanceKm: 4.02,
                calories: 245,
                elevation: 12
            ),
            run(
                id: "mock-run-3",
                daysAgo: 4,
                hour: 6,
                minute: 45,
                durationMinutes: 58,
                distanceKm: 10.00,
                calories: 598,
                elevation: 45
            ),
            run(
                id: "mock-run-4",
                daysAgo: 5,
                hour: 19,
                minute: 0,
                durationMinutes: 18,
                distanceKm: 3.01,
                calories: 178,
                elevation: nil
            ),
            run(
                id: "mock-run-5",
                daysAgo: 7,
                hour: 8,
                minute: 0,
                durationMinutes: 42,
                distanceKm: 6.50,
                calories: 398,
                elevation: 32
            ),
        ]
        let generatedRuns = (5..<65).map { index in
            run(
                id: "mock-run-\(index + 1)",
                daysAgo: index + 3,
                hour: [6, 7, 18, 19][index % 4],
                minute: [0, 15, 30, 45][index % 4],
                durationMinutes: 24 + (index % 9) * 4,
                distanceKm: 3.4 + Double(index % 12) * 0.55,
                calories: 220 + Double(index % 10) * 34,
                elevation: index % 3 == 0 ? nil : Double(8 + (index % 8) * 6)
            )
        }
        return featuredRuns + generatedRuns
    }

    private struct RunSpec {
        let id: String
        let daysAgo: Int
        let hour: Int
        let minute: Int
        let durationSeconds: Double
        let distanceKm: Double
        let calories: Double
        let elevation: Double?
        var avgHR: Double? = nil
        var maxHR: Double? = nil
        /// Quanto o pace piora do primeiro ao último km (0,10 = 10% de diferença).
        var fade: Double = 0
    }

    private static func run(
        id: String,
        daysAgo: Int,
        hour: Int,
        minute: Int,
        durationMinutes: Int,
        distanceKm: Double,
        calories: Double,
        elevation: Double?
    ) -> RunSpec {
        RunSpec(
            id: id,
            daysAgo: daysAgo,
            hour: hour,
            minute: minute,
            durationSeconds: Double(durationMinutes * 60),
            distanceKm: distanceKm,
            calories: calories,
            elevation: elevation
        )
    }

    private static func buildItem(now: Date, run spec: RunSpec, sourceBundle: String? = nil) -> HealthKitRunItem {
        guard let startDate = calendar.date(byAdding: .day, value: -spec.daysAgo, to: now).flatMap({
            calendar.date(bySettingHour: spec.hour, minute: spec.minute, second: 0, of: $0)
        }) else {
            fatalError("Mock dates inválidos")
        }
        let distanceMeters = spec.distanceKm * 1000
        let endDate = startDate.addingTimeInterval(spec.durationSeconds)
        let averagePaceSecondsPerKm = distanceMeters > 0 ? (spec.durationSeconds / (distanceMeters / 1000.0)) : 0

        return HealthKitRunItem(
            id: mockUUID(spec.id),
            startDate: startDate,
            endDate: endDate,
            durationSeconds: spec.durationSeconds,
            distanceMeters: distanceMeters,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            activeEnergyBurned: spec.calories,
            elevationGainMeters: spec.elevation,
            avgHR: spec.avgHR,
            maxHR: spec.maxHR,
            sourceBundleIdentifier: sourceBundle,
            wasUserEntered: false
        )
    }

    private static func detailedSession(now: Date, run spec: RunSpec, splitsSource: String) -> DetailedSessionPayload {
        let item = buildItem(now: now, run: spec)
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return DetailedSessionPayload(
            startDate: iso.string(from: item.startDate),
            appleHealthWorkoutUUID: item.id,
            athlyWorkoutId: nil,
            distanceMeters: item.distanceMeters,
            durationSeconds: item.durationSeconds,
            averagePaceSecondsPerKm: item.averagePaceSecondsPerKm,
            avgHR: item.avgHR,
            maxHR: item.maxHR,
            activeEnergyBurned: item.activeEnergyBurned,
            elevationGainMeters: nil,
            segments: kmSegments(for: spec, fromRoute: splitsSource == "route"),
            splitsSource: splitsSource
        )
    }

    /// Splits por km somando a duração total. Sintéticos: pace médio constante, como o fallback
    /// do aparelho. Rota: o pace piora ao longo do treino (`fade`, com ruído de GPS) e a FC sobe.
    private static func kmSegments(for spec: RunSpec, fromRoute: Bool) -> [SegmentPayload] {
        var distances = Array(repeating: 1.0, count: Int(spec.distanceKm))
        let leftover = spec.distanceKm - Double(distances.count)
        if leftover > 0.001 { distances.append((leftover * 1000).rounded() / 1000) }
        let progress = distances.indices.map { distances.count > 1 ? Double($0) / Double(distances.count - 1) : 0.5 }
        let weights = distances.indices.map { index -> Double in
            guard fromRoute else { return 1 }
            return 1 + spec.fade * (progress[index] - 0.5) + 0.015 * sin(Double(index + spec.daysAgo) * 1.7)
        }
        let weightedDistance = zip(distances, weights).reduce(0) { $0 + $1.0 * $1.1 }
        return distances.indices.map { index in
            let duration = spec.durationSeconds * distances[index] * weights[index] / weightedDistance
            let hr = fromRoute ? spec.avgHR.map { ($0 + 12 * (progress[index] - 0.5)).rounded() } : nil
            return SegmentPayload(
                label: .easy,
                index: nil,
                distanceKm: distances[index],
                durationSeconds: duration.rounded(),
                avgPaceSecondsPerKm: (duration / distances[index]).rounded(),
                avgHR: hr,
                peakHR: hr.map { min($0 + 6, spec.maxHR ?? $0 + 6) },
                endHR: hr.map { $0 + 3 }
            )
        }
    }
}
