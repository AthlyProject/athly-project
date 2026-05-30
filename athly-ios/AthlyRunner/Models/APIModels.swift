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

struct WorkoutModel: Codable, Identifiable, Sendable {
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
    let stravaActivityId: String?

    var parsedDate: Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = formatter.date(from: date) { return d }
        formatter.formatOptions = [.withInternetDateTime]
        if let d = formatter.date(from: date) { return d }
        // fallback: date-only
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.date(from: date) ?? Date()
    }
}

// MARK: - Training Plan

struct TrainingPlanResponse: Codable, Identifiable, Sendable {
    let id: String
    let startDate: String
    let objective: String
    let targetDate: String?
    let sports: [SportType]
    let autoGenerate: Bool
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
    let adherenceNote: String?
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
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.date(from: String(weekStartDate.prefix(10))) ?? Date()
    }

    var parsedEndDate: Date {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        return df.date(from: String(weekEndDate.prefix(10))) ?? Date()
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
    let startDate: String
    let distanceMeters: Double
    let durationSeconds: Double
    let averagePaceSecondsPerKm: Double
    let activeEnergyBurned: Double
    let elevationGainMeters: Double?

    init(from item: HealthKitRunItem) {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.startDate = iso.string(from: item.startDate)
        self.distanceMeters = item.distanceMeters
        self.durationSeconds = item.durationSeconds
        self.averagePaceSecondsPerKm = item.averagePaceSecondsPerKm
        self.activeEnergyBurned = item.activeEnergyBurned
        self.elevationGainMeters = item.elevationGainMeters
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
    let appleHealthWorkoutUUID: String
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

struct CreateGoalRequest: Encodable, Sendable {
    let goalText: String
}

struct CreateGoalResponse: Decodable, Sendable {
    let id: String
    let rawText: String
    let parsedGoal: ParsedGoal
    let active: Bool
    let createdAt: String
}

// MARK: - Update Profile

struct UpdateProfileRequest: Encodable, Sendable {
    let name: String?
    let availableDays: [String]?
}

// MARK: - Workout Feedback

struct WorkoutFeedbackRequest: Encodable, Sendable {
    let completed: Bool
    let effort: Int
    let fatigue: Int
}

struct EmptyResponse: Decodable, Sendable {}

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
