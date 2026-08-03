import Foundation
import CoreLocation

enum WorkoutImportFormat: String, Codable, CaseIterable, Sendable {
    case fit
    case tcx
    case gpx

    var displayName: String { rawValue.uppercased() }
}

struct ActivityHeartRateSample: Codable, Equatable, Sendable {
    let timestamp: Date
    let beatsPerMinute: Double
}

struct ActivityLap: Codable, Equatable, Sendable, Identifiable {
    let id: UUID
    let index: Int
    let startDate: Date
    let endDate: Date
    let distanceMeters: Double
    let durationSeconds: Double
    let averageHeartRate: Double?
    let maximumHeartRate: Double?

    init(
        id: UUID = UUID(),
        index: Int,
        startDate: Date,
        endDate: Date,
        distanceMeters: Double,
        durationSeconds: Double,
        averageHeartRate: Double? = nil,
        maximumHeartRate: Double? = nil
    ) {
        self.id = id
        self.index = index
        self.startDate = startDate
        self.endDate = endDate
        self.distanceMeters = distanceMeters
        self.durationSeconds = durationSeconds
        self.averageHeartRate = averageHeartRate
        self.maximumHeartRate = maximumHeartRate
    }
}

/// Activity normalized from a FIT, TCX or GPX file. The raw source file is never retained.
struct ImportedWorkout: Identifiable, Sendable {
    let id: UUID
    let format: WorkoutImportFormat
    let fingerprint: String
    let originalFileName: String
    let activityName: String?
    let sportType: String?
    let startDate: Date
    let endDate: Date
    let activeDurationSeconds: Double
    let totalDurationSeconds: Double
    let distanceMeters: Double
    let caloriesBurned: Double
    let elevationGainMeters: Double
    let isIndoor: Bool
    let route: [CLLocation]
    let heartRateSamples: [ActivityHeartRateSample]
    let laps: [ActivityLap]
    let pauseIntervals: [SplitCalculator.PauseInterval]
    let warnings: [String]

    init(
        id: UUID = UUID(),
        format: WorkoutImportFormat,
        fingerprint: String,
        originalFileName: String,
        activityName: String? = nil,
        sportType: String? = nil,
        startDate: Date,
        endDate: Date,
        activeDurationSeconds: Double,
        totalDurationSeconds: Double,
        distanceMeters: Double,
        caloriesBurned: Double = 0,
        elevationGainMeters: Double = 0,
        isIndoor: Bool = false,
        route: [CLLocation] = [],
        heartRateSamples: [ActivityHeartRateSample] = [],
        laps: [ActivityLap] = [],
        pauseIntervals: [SplitCalculator.PauseInterval] = [],
        warnings: [String] = []
    ) {
        self.id = id
        self.format = format
        self.fingerprint = fingerprint
        self.originalFileName = originalFileName
        self.activityName = activityName
        self.sportType = sportType
        self.startDate = startDate
        self.endDate = endDate
        self.activeDurationSeconds = activeDurationSeconds
        self.totalDurationSeconds = totalDurationSeconds
        self.distanceMeters = distanceMeters
        self.caloriesBurned = caloriesBurned
        self.elevationGainMeters = elevationGainMeters
        self.isIndoor = isIndoor
        self.route = route
        self.heartRateSamples = heartRateSamples
        self.laps = laps
        self.pauseIntervals = pauseIntervals
        self.warnings = warnings
    }

    var averagePaceSecondsPerKm: Double {
        guard distanceMeters > 0, activeDurationSeconds > 0 else { return 0 }
        return activeDurationSeconds / (distanceMeters / 1_000)
    }

    var averageHeartRate: Double? {
        guard !heartRateSamples.isEmpty else { return nil }
        return heartRateSamples.map(\.beatsPerMinute).reduce(0, +) / Double(heartRateSamples.count)
    }

    var maximumHeartRate: Double? {
        heartRateSamples.map(\.beatsPerMinute).max()
    }

    var hasRoute: Bool { route.count >= 2 }

    var runResult: RunResult {
        let kmSplits = hasRoute
            ? SplitCalculator.kmSplits(from: route, pauses: pauseIntervals)
            : []
        return RunResult(
            startDate: startDate,
            endDate: endDate,
            distanceMeters: distanceMeters,
            durationSeconds: activeDurationSeconds,
            averagePaceSecondsPerKm: averagePaceSecondsPerKm,
            elevationGainMeters: elevationGainMeters,
            caloriesBurned: caloriesBurned,
            locations: route,
            splits: kmSplits.map {
                SplitData(
                    kilometer: $0.kilometer,
                    distanceMeters: $0.distanceMeters,
                    durationSeconds: $0.durationSeconds,
                    elevationDelta: $0.elevationDelta
                )
            },
            pauseIntervals: pauseIntervals,
            heartRateSamples: heartRateSamples,
            laps: laps,
            isIndoor: isIndoor,
            importFingerprint: fingerprint,
            importFormat: format
        )
    }
}

enum WorkoutImportError: LocalizedError {
    case unsupportedFormat
    case fileTooLarge
    case invalidFile(String)
    case noActivities
    case incompatibleActivity

    var errorDescription: String? {
        switch self {
        case .unsupportedFormat:
            return "Escolha um arquivo FIT, TCX ou GPX válido."
        case .fileTooLarge:
            return "O arquivo excede o limite de 50 MB."
        case .invalidFile(let reason):
            return "Não foi possível ler a atividade: \(reason)"
        case .noActivities:
            return "Nenhuma atividade utilizável foi encontrada no arquivo."
        case .incompatibleActivity:
            return "O arquivo contém uma modalidade diferente de corrida."
        }
    }
}

enum WorkoutCompletionSelection: Sendable {
    case none
    case healthKit(HealthKitRunItem)
    case imported(ImportedWorkout, saveToHealthKit: Bool)
}
