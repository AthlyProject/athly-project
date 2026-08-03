import Foundation
import CoreLocation

enum HealthKitSyncStatus: String, Codable {
    case notRequested
    case pending
    case synced
    case failed
    case unavailable
}

final class RunSession: Identifiable, Codable {
    let id: UUID
    var startDate: Date
    var endDate: Date?
    var distanceMeters: Double
    var durationSeconds: Double
    var averagePaceSecondsPerKm: Double
    var elevationGainMeters: Double
    var caloriesBurned: Double
    var status: String // active, paused, completed
    var sportType: String // running, walking, trail

    var routePoints: [RoutePoint]
    var splits: [Split]
    /// Segmentos reais executados em treinos estruturados. Opcional para tolerar registros antigos.
    var segmentRecords: [SegmentRecord]?
    /// Origem, confiança e eventual limitação dos blocos exibidos. Opcional para manter
    /// compatibilidade com sessões salvas antes do motor compartilhado de segmentação.
    var workoutSegmentation: WorkoutSegmentationResult?
    /// Janelas de pausa explícita. Opcional para o decode tolerar registros antigos (o RunStore
    /// decodifica o array inteiro de uma vez — uma chave ausente lançaria e zeraria o histórico).
    /// Usado na releitura offline dos splits para descontar a pausa igual ao caminho ao vivo.
    var pauseIntervals: [SplitCalculator.PauseInterval]?
    /// Workout prescrito que originou esta corrida, quando iniciada a partir do plano.
    var athlyWorkoutId: String?
    /// UUID do HKWorkout salvo no Apple Health, quando a sincronizacao HealthKit conclui.
    var healthKitWorkoutUUID: String?
    /// Estado da tentativa de gravar esta corrida no Apple Health.
    var healthKitSyncStatus: HealthKitSyncStatus?
    /// Ultimo erro visivel de sync HealthKit. Local-only; usado para diagnostico/retentativa.
    var healthKitSyncError: String?
    /// Provenance and rich samples available only for imported files.
    var importFormat: WorkoutImportFormat?
    var importFingerprint: String?
    var importedHeartRateSamples: [ActivityHeartRateSample]?
    var importedLaps: [ActivityLap]?
    var totalDurationSeconds: Double?
    var isIndoor: Bool?

    // Sync with backend
    var backendId: String?
    var synced: Bool

    init(sportType: String = "running") {
        self.id = UUID()
        self.startDate = Date()
        self.endDate = nil
        self.distanceMeters = 0
        self.durationSeconds = 0
        self.averagePaceSecondsPerKm = 0
        self.elevationGainMeters = 0
        self.caloriesBurned = 0
        self.status = "active"
        self.sportType = sportType
        self.routePoints = []
        self.splits = []
        self.segmentRecords = []
        self.workoutSegmentation = nil
        self.pauseIntervals = []
        self.athlyWorkoutId = nil
        self.healthKitWorkoutUUID = nil
        self.healthKitSyncStatus = nil
        self.healthKitSyncError = nil
        self.importFormat = nil
        self.importFingerprint = nil
        self.importedHeartRateSamples = []
        self.importedLaps = []
        self.totalDurationSeconds = nil
        self.isIndoor = nil
        self.backendId = nil
        self.synced = false
    }

    var distanceKm: Double {
        distanceMeters / 1000.0
    }

    var formattedDistance: String {
        String(format: "%.2f", distanceKm)
    }

    var formattedDuration: String {
        let hours = Int(durationSeconds) / 3600
        let minutes = (Int(durationSeconds) % 3600) / 60
        let seconds = Int(durationSeconds) % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        }
        return String(format: "%02d:%02d", minutes, seconds)
    }

    var formattedPace: String {
        guard averagePaceSecondsPerKm > 0, averagePaceSecondsPerKm.isFinite else {
            return "--:--"
        }
        let minutes = Int(averagePaceSecondsPerKm) / 60
        let seconds = Int(averagePaceSecondsPerKm) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
