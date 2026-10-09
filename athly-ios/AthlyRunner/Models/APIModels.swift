import Foundation

// MARK: - Sport Type

enum SportType: String, Codable, CaseIterable, Sendable {
    case running
    case cycling
    case swimming
    case strength
    case crossfit
    case triathlon
    case duathlon
    case yoga
    case walking
    case other

    var label: String {
        switch self {
        case .running: return "Corrida"
        case .cycling: return "Ciclismo"
        case .swimming: return "Natação"
        case .strength: return "Força"
        case .crossfit: return "CrossFit"
        case .triathlon: return "Triathlon"
        case .duathlon: return "Duathlon"
        case .yoga: return "Yoga"
        case .walking: return "Caminhada"
        case .other: return "Outro"
        }
    }

    var emoji: String {
        switch self {
        case .running: return "🏃"
        case .cycling: return "🚴"
        case .swimming: return "🏊"
        case .strength: return "🏋️"
        case .crossfit: return "💪"
        case .triathlon: return "🏅"
        case .duathlon: return "🎽"
        case .yoga: return "🧘"
        case .walking: return "🚶"
        case .other: return "🏆"
        }
    }

    var sfSymbol: String {
        switch self {
        case .running: return "figure.run"
        case .cycling: return "figure.outdoor.cycle"
        case .swimming: return "figure.pool.swim"
        case .strength: return "figure.strengthtraining.traditional"
        case .crossfit: return "figure.cross.training"
        case .triathlon: return "medal"
        case .duathlon: return "figure.run"
        case .yoga: return "figure.yoga"
        case .walking: return "figure.walk"
        case .other: return "trophy"
        }
    }
}

// MARK: - Workout Status

enum WorkoutStatus: String, Codable, Sendable {
    case scheduled
    case done
    case skipped
    case partial
}

// MARK: - Weekly Goal Status

enum WeeklyGoalStatus: String, Codable, Sendable {
    case PLANNED
    case GENERATED
    case CANCELLED
    case LOCKED
}

// MARK: - Workout Block

struct WorkoutBlock: Codable, Sendable {
    let type: String
    let duration: Double?
    let distance: Double?
    /// Backend envia no formato "M:SS" (ex.: "5:12"), não número.
    let targetPace: String?
    let instructions: String?

    enum CodingKeys: String, CodingKey {
        case type
        case duration
        case distance
        case durationMinutes
        case distanceKm
        case targetPace
        case instructions
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = (try c.decodeIfPresent(String.self, forKey: .type)) ?? "rest"
        var d: Double? = try c.decodeIfPresent(Double.self, forKey: .duration)
        if d == nil { d = try c.decodeIfPresent(Double.self, forKey: .durationMinutes) }
        duration = d
        var dist: Double? = try c.decodeIfPresent(Double.self, forKey: .distance)
        if dist == nil { dist = try c.decodeIfPresent(Double.self, forKey: .distanceKm) }
        distance = dist
        targetPace = try c.decodeIfPresent(String.self, forKey: .targetPace)
        instructions = try c.decodeIfPresent(String.self, forKey: .instructions)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(type, forKey: .type)
        try c.encodeIfPresent(duration, forKey: .duration)
        try c.encodeIfPresent(distance, forKey: .distance)
        try c.encodeIfPresent(targetPace, forKey: .targetPace)
        try c.encodeIfPresent(instructions, forKey: .instructions)
    }
}

// MARK: - Workout Segments (structured tree — fonte da verdade para o tracker)

enum SegmentKind: String, Codable, Sendable {
    case warmup
    case work
    case recovery
    case cooldown
    case rest
    case set
    /// Fallback decodável para qualquer kind desconhecido enviado pelo backend.
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = SegmentKind(rawValue: raw) ?? .unknown
    }
}

enum SegmentEndBy: String, Codable, Sendable {
    case distanceM
    case durationSec
    case reps
}

struct SegmentEndCondition: Codable, Sendable {
    let by: SegmentEndBy
    let value: Double
}

/// Estrutura "fat" com todos os campos opcionais por esporte. iOS só consome — não gera targets.
struct SegmentTarget: Codable, Sendable {
    // running
    let paceSecPerKmMin: Int?
    let paceSecPerKmMax: Int?
    let hrZone: Int?
    let rpe: Int?
    var hrMinBpm: Int? = nil
    var hrMaxBpm: Int? = nil
    var hrIsEstimated: Bool? = nil
    // cycling
    let powerWattsMin: Int?
    let powerWattsMax: Int?
    let cadenceRpm: Int?
    // swimming
    let strokeType: String?
    let poolLengthM: Int?
    let targetSecPer100m: Int?
    // strength
    let exercise: String?
    let reps: Int?
    let loadKg: Double?
    let loadPctOf1RM: Double?
    let tempoSec: String?
    let restAfterSec: Int?
}

/// Nó da árvore de segmentos. Recursivo via `children: [Segment]?`.
struct Segment: Codable, Sendable, Identifiable {
    let id: String
    let kind: SegmentKind
    let label: String?
    let cue: String?
    let end: SegmentEndCondition?
    let repetitions: Int?
    let target: SegmentTarget?
    let children: [Segment]?
    let notes: String?
}

struct WorkoutSegments: Codable, Sendable {
    let schemaVersion: Int
    let sport: SportType
    let segments: [Segment]
}

// MARK: - Workout Model

struct NextWeekGeneration: Codable, Sendable {
    let closed: Bool
    let generationId: String?
    let status: String?
    let pollAfterSeconds: Int
}

struct WorkoutModel: Codable, Identifiable, Sendable {
    var nextWeekGeneration: NextWeekGeneration? = nil
    let id: String
    let date: String
    let sportType: SportType
    let title: String
    let description: String?
    let blocks: [WorkoutBlock]
    /// Árvore estruturada. Quando presente, vira a fonte da verdade do tracker
    /// (cues de transição, contagem regressiva, voz). Quando nil, o app cai
    /// no renderer/tracker legado baseado em `blocks`.
    let segments: WorkoutSegments?
    let status: WorkoutStatus
    let trainingPlanId: String?
    let weeklyGoalId: String?
    /// Backend envia número (pode ser decimal); aceitamos Double para evitar falha de decode.
    let intensity: Double?
    let isGoalAttempt: Bool?
    let actualDistanceMeters: Double?
    let actualDurationSeconds: Double?
    let stravaActivityId: String?
    let appleHealthWorkoutUUID: String?

    var parsedDate: Date {
        WorkoutDateParser.date(from: date) ?? Date()
    }

    func isOnDay(_ day: Date, calendar: Calendar = .current) -> Bool {
        calendar.isDate(parsedDate, inSameDayAs: day)
    }

    var isToday: Bool {
        isOnDay(Date())
    }

    /// Pode iniciar este treino agora? Verdadeiro quando está `scheduled` e hoje está entre o dia
    /// marcado e 2 dias depois (janela de tolerância). Não habilita treino futuro nem atrasado >2 dias.
    var canStartNow: Bool {
        guard status == .scheduled else { return false }
        let cal = Calendar.current
        let day = cal.startOfDay(for: parsedDate)
        let today = cal.startOfDay(for: Date())
        let delta = cal.dateComponents([.day], from: day, to: today).day ?? -1
        return delta >= 0 && delta <= 2
    }
}

// MARK: - Update Workout

/// Corpo do `PUT /workouts/:id`. Hoje só usamos `date` (reagendamento via drag-and-drop),
/// mas o endpoint aceita atualização parcial de outros campos.
struct UpdateWorkoutRequest: Encodable, Sendable {
    let date: String
}

// MARK: - Training Plan

struct TrainingPlanResponse: Codable, Identifiable, Sendable {
    let id: String
    let startDate: String
    let objective: String
    let targetDate: String?
    let sports: [SportType]
    let autoGenerate: Bool
    /// Optional para tolerar caches/respostas antigas sem o campo. Valores: ACTIVE | DRAFT | COMPLETED | CANCELLED | LOCKED.
    let status: String?
    let createdAt: String
    let updatedAt: String
}

// MARK: - Weekly Goal Metrics

struct WeeklyGoalMetrics: Codable, Sendable {
    let title: String?
    // RunAnalysis fields stored by AI planner
    let trend: String?
    let fitnessInsights: String?
    let avgPace: String?
    let totalDistanceKm: Double?
    let runsAnalyzed: Int?
    let period: String?
    let avgDistanceKm: Double?
    let avgHeartRate: Double?

    /// Converte as métricas armazenadas no WeeklyGoal para um RunAnalysis exibível.
    var asRunAnalysis: RunAnalysis? {
        guard let insights = fitnessInsights, !insights.isEmpty else { return nil }
        return RunAnalysis(
            title: title,
            runsAnalyzed: runsAnalyzed ?? 0,
            period: period ?? "N/A",
            avgDistanceKm: avgDistanceKm ?? 0,
            avgPace: avgPace ?? "N/A",
            avgHeartRate: avgHeartRate,
            totalDistanceKm: totalDistanceKm ?? 0,
            trend: trend ?? "maintaining",
            fitnessInsights: insights
        )
    }
}

// MARK: - Previous Week Analysis

struct PreviousWeekAnalysis: Codable, Sendable {
    let completedWorkouts: Int?
    let totalWorkouts: Int?
    let completionRate: Double?
    let totalDistanceKm: Double?
    let avgEffort: Double?
    let avgFatigue: Double?
    let skippedWorkouts: [String]?
    let volumeChange: String?
}

// MARK: - Weekly Goal

struct WeeklyGoalResponse: Codable, Identifiable, Sendable {
    let id: String
    let trainingPlanId: String
    let weekStartDate: String
    let weekEndDate: String
    let status: WeeklyGoalStatus
    let metrics: WeeklyGoalMetrics?
    let previousWeekAnalysis: PreviousWeekAnalysis?

    var parsedStartDate: Date {
        WorkoutDateParser.date(from: String(weekStartDate.prefix(10))) ?? Date()
    }

    var parsedEndDate: Date {
        WorkoutDateParser.date(from: String(weekEndDate.prefix(10))) ?? Date()
    }
}

// MARK: - Run Analysis (AI summary)

struct RunAnalysis: Codable, Sendable {
    let title: String?
    let runsAnalyzed: Int
    let period: String
    let avgDistanceKm: Double
    let avgPace: String
    /// Backend pode enviar número inteiro ou decimal; aceitamos Double para evitar falha de decode.
    let avgHeartRate: Double?
    let totalDistanceKm: Double
    let trend: String
    let fitnessInsights: String
}

// MARK: - Plan From Health

struct HealthRunPayload: Encodable, Sendable {
    let appleHealthWorkoutUUID: String
    let startDate: String
    let distanceMeters: Double
    let durationSeconds: Double
    let averagePaceSecondsPerKm: Double
    let activeEnergyBurned: Double
    let elevationGainMeters: Double?
    let avgHR: Double?
    let maxHR: Double?

    init(from item: HealthKitRunItem) {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.appleHealthWorkoutUUID = item.id
        self.startDate = iso.string(from: item.startDate)
        self.distanceMeters = item.distanceMeters
        self.durationSeconds = item.durationSeconds
        self.averagePaceSecondsPerKm = item.averagePaceSecondsPerKm
        self.activeEnergyBurned = item.activeEnergyBurned
        self.elevationGainMeters = item.elevationGainMeters
        self.avgHR = item.avgHR
        self.maxHR = item.maxHR
    }
}

enum SegmentLabel: String, Encodable, Sendable {
    case warmup
    case easy
    case tempo
    case rep
    case rec
    case cooldown
}

struct SegmentPayload: Encodable, Sendable {
    let label: SegmentLabel
    let index: Int?
    let distanceKm: Double
    let durationSeconds: Double
    let avgPaceSecondsPerKm: Double?
    let avgHR: Double?
    let peakHR: Double?
    let endHR: Double?
}

/// Detailed per-segment session payload for AI execution analysis (intervals, tempos, etc.).
/// Mirrors backend `DetailedSessionDto`. Segmentation happens on the client to keep prompt lean.
struct DetailedSessionPayload: Encodable, Sendable {
    let startDate: String
    let appleHealthWorkoutUUID: String?
    let athlyWorkoutId: String?
    let distanceMeters: Double
    let durationSeconds: Double
    let averagePaceSecondsPerKm: Double?
    let avgHR: Double?
    let maxHR: Double?
    let activeEnergyBurned: Double?
    let elevationGainMeters: Double?
    let segments: [SegmentPayload]
    /// "events" | "route" | "synthetic" — sinaliza ao backend a fonte dos splits para análise de confiança.
    let splitsSource: String?
}

struct PlanFromHealthRequest: Encodable, Sendable {
    let runs: [HealthRunPayload]
    let detailedSessions: [DetailedSessionPayload]?
    let weekStartDate: String?
}

struct AiPlannerResponse: Decodable, Sendable {
    let weeklyGoal: WeeklyGoalResponse
    let workouts: [WorkoutModel]
    let analysis: RunAnalysis
}

struct AiPlannerGenerationStartResponse: Decodable, Sendable {
    let generationId: String
    let status: String
    let pollAfterSeconds: Int
    let message: String
}

struct AiPlannerGenerationStatusResponse: Decodable, Sendable {
    let generationId: String
    let status: String
    let pollAfterSeconds: Int
    let message: String
    let error: String?
    let weeklyGoalId: String?
    let workoutIds: [String]?
}

// MARK: - User Goal

struct ParsedGoal: Codable, Sendable {
    let isRunningRelated: Bool
    let targetDistance: String?
    let targetTime: String?
    let eventDate: String?
    let eventName: String?
    let experienceLevel: String?
    let summary: String
    let rejectionReason: String?
}

struct CreateGoalResponse: Decodable, Sendable {
    let id: String
    let rawText: String
    let parsedGoal: ParsedGoal
    let feasibility: GoalFeasibility?
    let active: Bool
    let createdAt: String
}

/// Veredito determinístico (VDOT) de viabilidade da meta vs. objetivo do plano.
struct GoalFeasibility: Codable, Sendable {
    let verdict: String          // ready | feasible | ambitious | unrealistic
    let currentVdot: Double
    let requiredVdot: Double
    let projectedVdot: Double
    let targetDistanceMeters: Double
    let targetTimeSec: Double
    let currentProjectedTimeSec: Double
    let weeksAvailable: Double
    let lowConfidence: Bool
    let suggestion: Suggestion?

    struct Suggestion: Codable, Sendable {
        let realisticTimeSec: Double?
        let suggestedDate: String?
    }
}

// MARK: - Update Profile

struct UpdateProfileRequest: Encodable, Sendable {
    let name: String?
    let weight: Double?
    let height: Double?
    let dateOfBirth: String?
    let availableDays: [String]?
    let gender: String?
    let restingHeartRate: Int?
    let maxHeartRate: Int?
    let clearRestingHeartRate: Bool
    let clearMaxHeartRate: Bool

    init(
        name: String? = nil,
        weight: Double? = nil,
        height: Double? = nil,
        dateOfBirth: String? = nil,
        availableDays: [String]? = nil,
        gender: String? = nil,
        restingHeartRate: Int? = nil,
        maxHeartRate: Int? = nil,
        clearRestingHeartRate: Bool = false,
        clearMaxHeartRate: Bool = false
    ) {
        self.name = name
        self.weight = weight
        self.height = height
        self.dateOfBirth = dateOfBirth
        self.availableDays = availableDays
        self.gender = gender
        self.restingHeartRate = restingHeartRate
        self.maxHeartRate = maxHeartRate
        self.clearRestingHeartRate = clearRestingHeartRate
        self.clearMaxHeartRate = clearMaxHeartRate
    }

    private enum CodingKeys: String, CodingKey {
        case name, weight, height, dateOfBirth, availableDays, gender, restingHeartRate, maxHeartRate
    }

    // Omissão preserva os campos. Só a ação explícita de voltar ao automático envia null.
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(weight, forKey: .weight)
        try container.encodeIfPresent(height, forKey: .height)
        try container.encodeIfPresent(dateOfBirth, forKey: .dateOfBirth)
        try container.encodeIfPresent(availableDays, forKey: .availableDays)
        try container.encodeIfPresent(gender, forKey: .gender)
        if clearRestingHeartRate { try container.encodeNil(forKey: .restingHeartRate) }
        else { try container.encodeIfPresent(restingHeartRate, forKey: .restingHeartRate) }
        if clearMaxHeartRate { try container.encodeNil(forKey: .maxHeartRate) }
        else { try container.encodeIfPresent(maxHeartRate, forKey: .maxHeartRate) }
    }
}

// MARK: - Workout Feedback

struct WorkoutFeedbackRequest: Encodable, Sendable {
    let completed: Bool
    let effort: Int
    let fatigue: Int
}

struct EmptyResponse: Decodable, Sendable {}

// MARK: - Relógio Garmin (app Connect IQ)

/// Relógio pareado com o app Connect IQ da Athly (`GET /connect-iq/devices`).
struct ConnectIqDevice: Decodable, Identifiable, Sendable, Equatable {
    let id: String
    /// `pending` até o relógio buscar o token e sincronizar pela primeira vez; depois `active`.
    let status: String
    let partNumber: String?
    let appVersion: String?
    /// Datas ISO 8601 com milissegundos (o decoder padrão do app não aceita frações de segundo).
    let pairedAt: String
    let lastSeenAt: String?
    let lastSyncAt: String?
    let lastSync: ConnectIqLastSync?

    var isActive: Bool { status == "active" }

    var lastSyncDate: Date? {
        lastSyncAt.flatMap { try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse($0) }
    }
}

/// Resumo da última sincronização enviado pelo relógio.
struct ConnectIqLastSync: Decodable, Sendable, Equatable {
    let downloaded: Int
    let removed: Int
    let failed: Int
    let storageFull: Bool
    let syncedIds: [String]
}

struct ClaimConnectIqPairingRequest: Encodable, Sendable {
    let code: String
}

// MARK: - Week (assembled on client)

struct Week: Identifiable, Sendable {
    let id: String
    let number: Int
    let weeklyGoal: WeeklyGoalResponse?
    let workouts: [WorkoutModel]
}

// MARK: - Admin Weekly Report

struct AdminPromptLog: Codable, Sendable {
    let promptText: String
    let rawResponse: String
    let modelUsed: String
    let promptVersion: String
    let generationType: String
    let createdAt: String
}

struct AdminWorkoutSummary: Codable, Identifiable, Sendable {
    let id: String
    let dateScheduled: String
    let title: String
    let description: String?
    let status: String
    let actualDistanceMeters: Double?
    let actualDurationSeconds: Double?
}

struct AdminWeeklyReportResponse: Codable, Sendable {
    let id: String
    let weekStartDate: String
    let weekEndDate: String
    let metrics: WeeklyGoalMetrics?
    let previousWeekAnalysis: PreviousWeekAnalysis?
    let promptLog: AdminPromptLog?
    let workouts: [AdminWorkoutSummary]
}

struct ResumePlanResponse: Decodable, Sendable {
    let weekStartDate: String?
    let generation: AiPlannerGenerationStatusResponse?
    let started: Bool
}

/// Bounded, thread-safe parsing cache. Date-only values are local calendar days, not UTC instants.
final class WorkoutDateParser: @unchecked Sendable {
    private static let shared = WorkoutDateParser()
    private let lock = NSLock()
    private let cache = NSCache<NSString, NSDate>()
    private let day = DateFormatter()
    private let fractional = ISO8601DateFormatter()
    private let internet = ISO8601DateFormatter()

    private init() {
        cache.countLimit = 4096
        day.calendar = Calendar(identifier: .gregorian)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        day.isLenient = false
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        internet.formatOptions = [.withInternetDateTime]
    }

    static func date(from value: String, timeZone: TimeZone = .current) -> Date? {
        let parser = shared
        parser.lock.lock()
        defer { parser.lock.unlock() }
        let key = "\(timeZone.identifier)|\(value)" as NSString
        if let cached = parser.cache.object(forKey: key) { return cached as Date }
        let result: Date?
        if value.count == 10 {
            parser.day.timeZone = timeZone
            result = parser.day.date(from: value)
        } else {
            result = parser.fractional.date(from: value) ?? parser.internet.date(from: value)
        }
        if let result { parser.cache.setObject(result as NSDate, forKey: key) }
        return result
    }
}

struct WorkoutIndex {
    var byID: [String: WorkoutModel] = [:]
    var byDay: [Date: [WorkoutModel]] = [:]
    var byGoal: [String: [WorkoutModel]] = [:]
    var thisWeek: [WorkoutModel] = []
    var streak = 0

    init(_ workouts: [WorkoutModel] = [], now: Date = Date(), calendar: Calendar = .current) {
        var weekCalendar = calendar
        weekCalendar.firstWeekday = 2
        let interval = weekCalendar.dateInterval(of: .weekOfYear, for: now)
        let dated = workouts.map { ($0, $0.parsedDate) }.sorted { $0.1 < $1.1 }
        for (workout, date) in dated {
            byID[workout.id] = workout
            if let goal = workout.weeklyGoalId { byGoal[goal, default: []].append(workout) }
            guard workout.sportType != .other else { continue }
            byDay[calendar.startOfDay(for: date), default: []].append(workout)
            if let interval, interval.contains(date) { thisWeek.append(workout) }
        }
        streak = StreakCalculator.currentStreak(entries: dated.filter { $0.0.sportType != .other }
            .map { (date: $0.1, status: $0.0.status) }, now: now)
    }
}
