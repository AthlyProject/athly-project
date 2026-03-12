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
    let targetPace: Double?
    let instructions: String?
}

// MARK: - Workout Model

struct WorkoutModel: Codable, Identifiable, Sendable {
    let id: String
    let date: String
    let sportType: SportType
    let title: String
    let description: String?
    let blocks: [WorkoutBlock]
    let status: WorkoutStatus
    let trainingPlanId: String?
    let weeklyGoalId: String?
    let intensity: Int?
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
}

// MARK: - Weekly Goal

struct WeeklyGoalResponse: Codable, Identifiable, Sendable {
    let id: String
    let trainingPlanId: String
    let weekStartDate: String
    let weekEndDate: String
    let status: WeeklyGoalStatus
    let metrics: WeeklyGoalMetrics?

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

// MARK: - Plan Next Week

struct PlanNextWeekRequest: Encodable, Sendable {
    let numberOfRuns: Int?
    let weekStartDate: String?
}

struct PlanNextWeekResponse: Decodable, Sendable {
    let weeklyGoal: WeeklyGoalResponse
    let workouts: [WorkoutModel]
}

// MARK: - Week (assembled on client)

struct Week: Identifiable, Sendable {
    let id: String
    let number: Int
    let weeklyGoal: WeeklyGoalResponse?
    let workouts: [WorkoutModel]
}
