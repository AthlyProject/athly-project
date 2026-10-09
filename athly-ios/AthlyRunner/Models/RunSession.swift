import Foundation
import CoreLocation

enum HealthKitSyncStatus: String, Codable, Sendable {
    case notRequested
    case pending
    case synced
    case failed
    case unavailable
}

enum HealthKitRouteSyncStatus: String, Codable, Sendable {
    case attached
    case localOnly
    case replacementCreated
    case failed
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
    /// Resultado específico do enriquecimento de rota de uma atividade importada.
    var healthKitRouteSyncStatus: HealthKitRouteSyncStatus?
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

    init(id: UUID = UUID(), sportType: String = "running") {
        self.id = id
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
        self.healthKitRouteSyncStatus = nil
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
        LocalizedFormatting.formattedDistanceKm(distanceKm)
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

struct RunSessionSnapshot: Codable, Sendable {
    let id: UUID
    let startDate: Date
    let endDate: Date?
    let distanceMeters: Double
    let durationSeconds: Double
    let averagePaceSecondsPerKm: Double
    let elevationGainMeters: Double
    let caloriesBurned: Double
    let status: String
    let sportType: String
    let routePoints: [RoutePoint]
    let splits: [Split]
    let segmentRecords: [SegmentRecord]?
    let workoutSegmentation: WorkoutSegmentationResult?
    let pauseIntervals: [SplitCalculator.PauseInterval]?
    let athlyWorkoutId: String?
    let healthKitWorkoutUUID: String?
    let healthKitSyncStatus: HealthKitSyncStatus?
    let healthKitSyncError: String?
    let healthKitRouteSyncStatus: HealthKitRouteSyncStatus?
    let importFormat: WorkoutImportFormat?
    let importFingerprint: String?
    let importedHeartRateSamples: [ActivityHeartRateSample]?
    let importedLaps: [ActivityLap]?
    let totalDurationSeconds: Double?
    let isIndoor: Bool?
    let backendId: String?
    let synced: Bool

    init(_ session: RunSession) {
        self.id = session.id
        self.startDate = session.startDate
        self.endDate = session.endDate
        self.distanceMeters = session.distanceMeters
        self.durationSeconds = session.durationSeconds
        self.averagePaceSecondsPerKm = session.averagePaceSecondsPerKm
        self.elevationGainMeters = session.elevationGainMeters
        self.caloriesBurned = session.caloriesBurned
        self.status = session.status
        self.sportType = session.sportType
        self.routePoints = session.routePoints
        self.splits = session.splits
        self.segmentRecords = session.segmentRecords
        self.workoutSegmentation = session.workoutSegmentation
        self.pauseIntervals = session.pauseIntervals
        self.athlyWorkoutId = session.athlyWorkoutId
        self.healthKitWorkoutUUID = session.healthKitWorkoutUUID
        self.healthKitSyncStatus = session.healthKitSyncStatus
        self.healthKitSyncError = session.healthKitSyncError
        self.healthKitRouteSyncStatus = session.healthKitRouteSyncStatus
        self.importFormat = session.importFormat
        self.importFingerprint = session.importFingerprint
        self.importedHeartRateSamples = session.importedHeartRateSamples
        self.importedLaps = session.importedLaps
        self.totalDurationSeconds = session.totalDurationSeconds
        self.isIndoor = session.isIndoor
        self.backendId = session.backendId
        self.synced = session.synced
    }

    @MainActor func restore() -> RunSession {
        let session = RunSession(id: id, sportType: sportType)
        session.startDate = startDate
        session.endDate = endDate
        session.distanceMeters = distanceMeters
        session.durationSeconds = durationSeconds
        session.averagePaceSecondsPerKm = averagePaceSecondsPerKm
        session.elevationGainMeters = elevationGainMeters
        session.caloriesBurned = caloriesBurned
        session.status = status
        session.sportType = sportType
        session.routePoints = routePoints
        session.splits = splits
        session.segmentRecords = segmentRecords
        session.workoutSegmentation = workoutSegmentation
        session.pauseIntervals = pauseIntervals
        session.athlyWorkoutId = athlyWorkoutId
        session.healthKitWorkoutUUID = healthKitWorkoutUUID
        session.healthKitSyncStatus = healthKitSyncStatus
        session.healthKitSyncError = healthKitSyncError
        session.healthKitRouteSyncStatus = healthKitRouteSyncStatus
        session.importFormat = importFormat
        session.importFingerprint = importFingerprint
        session.importedHeartRateSamples = importedHeartRateSamples
        session.importedLaps = importedLaps
        session.totalDurationSeconds = totalDurationSeconds
        session.isIndoor = isIndoor
        session.backendId = backendId
        session.synced = synced
        return session
    }
}
