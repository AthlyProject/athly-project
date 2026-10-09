import Foundation

struct HeartRateZones: Decodable, Sendable, Equatable {
    let status: String
    let method: String
    let isEstimated: Bool
    let missingData: [String]
    let restingHeartRate: Value?
    let maxHeartRate: Value?
    let zones: [Zone]
    var trainingGuidance: TrainingGuidance? = nil

    var shouldShowInProfile: Bool {
        status == "available" && trainingGuidance?.mode == "heart_rate_and_rpe"
    }

    struct TrainingGuidance: Decodable, Sendable, Equatable {
        let mode: String
        let reason: String
        let lastHeartRateRunAt: String?
    }

    struct Value: Decodable, Sendable, Equatable {
        let bpm: Int
        let source: String
        let measuredAt: String?

        var sourceLabel: String {
            switch source {
            case "manual": return String(localized: "Informado por você")
            case "apple_health": return "Apple Health"
            case "age_estimate": return String(localized: "Estimado pela idade")
            default: return String(localized: "Origem indisponível")
            }
        }

        var measurementDate: Date? {
            guard let measuredAt else { return nil }
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return iso.date(from: measuredAt) ?? ISO8601DateFormatter().date(from: measuredAt)
        }
    }

    struct Zone: Decodable, Sendable, Equatable, Identifiable {
        let zone: Int
        let minBpm: Int
        let maxBpm: Int
        var id: Int { zone }

        var intensity: String {
            switch zone {
            case 1: return String(localized: "Muito leve")
            case 2: return String(localized: "Leve")
            case 3: return String(localized: "Moderada")
            case 4: return String(localized: "Intensa")
            default: return String(localized: "Muito intensa")
            }
        }
    }
}

struct HeartRateHealthSnapshot: Sendable, Equatable {
    let restingHeartRate: Int
    let measuredAt: Date
    let capturedAt: Date
}

struct HeartRateHealthRequest: Encodable, Sendable {
    let restingHeartRate: Int
    let measuredAt: String
    let capturedAt: String

    init(_ snapshot: HeartRateHealthSnapshot) {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        restingHeartRate = snapshot.restingHeartRate
        measuredAt = iso.string(from: snapshot.measuredAt)
        capturedAt = iso.string(from: snapshot.capturedAt)
    }
}

protocol HeartRateHealthProviding: Sendable {
    func requestHeartRateReadAuthorization() async throws
    func fetchRestingHeartRate() async throws -> HeartRateHealthSnapshot?
}

/// Reused by generation and background sync, independently of the profile screen.
enum HeartRateHealthSync {
    @discardableResult
    static func sync(api: APIClient, health: any HeartRateHealthProviding, session: UUID) async throws -> HeartRateZones? {
        guard let snapshot = try await health.fetchRestingHeartRate() else { return nil }
        try Task.checkCancellation()
        return try await api.syncHeartRateHealth(snapshot, session: session)
    }
}
